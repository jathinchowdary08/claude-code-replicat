/**
 * The core agent loop. An async generator that drives the stream → tool_use →
 * tool_result → continue cycle, yielding typed {@link AgentEvent}s to the UI.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { streamAssistant } from '../llm/stream.js';
import { costOf, usageFrom } from '../llm/tokens.js';
import { DEFAULT_MAX_TOKENS, resolveModel } from '../llm/models.js';
import type { ToolRegistry } from '../tools/registry.js';
import { errorResult, type ToolContext, type ToolResult } from '../tools/types.js';
import type { PermissionEngine } from '../permissions/engine.js';
import type { HookRunner } from '../hooks/runner.js';
import { AppError, errorMessage, formatError, isCancel } from '../util/errors.js';
import { throwIfCancelled } from '../util/cancel.js';
import { maybeCompact } from './compaction.js';
import { buildReminders } from './reminders.js';
import type { AgentEvent, ConfirmPermission } from './events.js';

export interface RunAgentOptions {
  client: Anthropic;
  model: string;
  system: string;
  registry: ToolRegistry;
  /** Running conversation; mutated in place as the loop progresses. */
  messages: Anthropic.MessageParam[];
  signal: AbortSignal;
  permissions: PermissionEngine;
  hooks: HookRunner;
  ctx: ToolContext;
  confirmPermission: ConfirmPermission;
  maxTokens?: number;
  maxTurns?: number;
  enableCompaction?: boolean;
  /** Extended-thinking budget in tokens (omit/0 to disable). */
  thinkingBudget?: number;
  /** Called for each message appended to the conversation (for session persistence). */
  onMessage?: (message: Anthropic.MessageParam) => void;
}

function toAppError(err: unknown): AppError {
  return err instanceof AppError ? err : new AppError(errorMessage(err), { cause: err });
}

function toToolResultBlock(id: string, res: ToolResult): Anthropic.ToolResultBlockParam {
  const content: Anthropic.ToolResultBlockParam['content'] = [{ type: 'text', text: res.output }];
  if (res.images) {
    for (const img of res.images) {
      (content as Anthropic.ContentBlockParam[]).push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.data },
      });
    }
  }
  return { type: 'tool_result', tool_use_id: id, content, is_error: res.isError };
}

export async function* runAgent(opts: RunAgentOptions): AsyncGenerator<AgentEvent, void> {
  const { client, model, registry, messages, signal, permissions, hooks, ctx, confirmPermission } = opts;
  // Thinking budget must leave room for the response, so floor max_tokens above it.
  const maxTokens = Math.max(opts.maxTokens ?? DEFAULT_MAX_TOKENS, (opts.thinkingBudget ?? 0) + 1024);
  const contextWindow = resolveModel(model).contextWindow;
  let turns = 0;

  while (true) {
    if (opts.maxTurns !== undefined && turns >= opts.maxTurns) {
      yield { type: 'turn_end', stopReason: 'max_turns' };
      return;
    }
    turns++;

    try {
      throwIfCancelled(signal);

      if (opts.enableCompaction) {
        await maybeCompact({ client, model, messages, contextWindow });
      }

      // ---- Stream the assistant turn ----
      const gen = streamAssistant({
        client,
        model,
        system: opts.system,
        messages,
        tools: registry.api,
        maxTokens,
        signal,
        thinkingBudget: opts.thinkingBudget,
      });
      let step = await gen.next();
      while (!step.done) {
        const chunk = step.value;
        if (chunk.type === 'text') yield { type: 'assistant_text', delta: chunk.text };
        else yield { type: 'thinking', delta: chunk.text };
        step = await gen.next();
      }
      const final = step.value;

      const usage = usageFrom(final.usage);
      yield { type: 'usage', usage, cost: costOf(model, usage) };

      const assistantMessage: Anthropic.MessageParam = {
        role: 'assistant',
        content: final.content as Anthropic.ContentBlockParam[],
      };
      messages.push(assistantMessage);
      opts.onMessage?.(assistantMessage);

      if (final.stop_reason !== 'tool_use') {
        await hooks.run('Stop', { stopReason: final.stop_reason });
        yield { type: 'turn_end', stopReason: final.stop_reason };
        return;
      }

      // ---- Execute tool calls ----
      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      const resultBlocks: Anthropic.ContentBlockParam[] = [];

      for (const tu of toolUses) {
        throwIfCancelled(signal);
        const tool = registry.get(tu.name);
        const title = (tool?.prompt?.(tu.input as never) ?? tu.name) as string;
        yield { type: 'tool_request', id: tu.id, name: tu.name, input: tu.input, title };

        // PreToolUse hook can block.
        const pre = await hooks.run('PreToolUse', { tool: tu.name, input: tu.input }, tu.name);
        if (pre.block) {
          const res = errorResult(pre.reason ?? `Blocked by a PreToolUse hook.`);
          resultBlocks.push(toToolResultBlock(tu.id, res));
          yield { type: 'tool_denied', id: tu.id, name: tu.name, reason: res.output };
          continue;
        }

        if (!tool) {
          const res = errorResult(`Unknown tool: ${tu.name}`);
          resultBlocks.push(toToolResultBlock(tu.id, res));
          yield { type: 'tool_result', id: tu.id, name: tu.name, result: res };
          continue;
        }

        // Permission decision.
        const decision = permissions.decide(tool, tu.input);
        if (decision.decision === 'deny') {
          const res = errorResult(decision.reason ?? `Permission denied for ${tu.name}.`);
          resultBlocks.push(toToolResultBlock(tu.id, res));
          yield { type: 'tool_denied', id: tu.id, name: tu.name, reason: res.output };
          continue;
        }
        if (decision.decision === 'ask') {
          const resolution = await confirmPermission({ tool, input: tu.input, title });
          if (resolution.behavior === 'allow' && resolution.always) {
            permissions.grants.allowAlways(tool.name, tu.input, resolution.scope ?? 'tool');
          }
          if (resolution.behavior !== 'allow') {
            const res = errorResult(resolution.message ?? `User denied permission to run ${tu.name}.`);
            resultBlocks.push(toToolResultBlock(tu.id, res));
            yield { type: 'tool_denied', id: tu.id, name: tu.name, reason: res.output };
            continue;
          }
        }

        // Run the tool.
        let res: ToolResult;
        try {
          res = await registry.dispatch(tu.name, tu.input, ctx, signal);
        } catch (err) {
          if (isCancel(err)) throw err;
          res = errorResult(formatError(err));
        }

        await hooks.run('PostToolUse', { tool: tu.name, input: tu.input, output: res.output }, tu.name);
        resultBlocks.push(toToolResultBlock(tu.id, res));
        yield { type: 'tool_result', id: tu.id, name: tu.name, result: res };
      }

      // Append all tool results (plus any reminders) as one user message, then continue.
      const reminder = buildReminders(ctx);
      if (reminder) resultBlocks.push({ type: 'text', text: reminder });
      const toolResultMessage: Anthropic.MessageParam = { role: 'user', content: resultBlocks };
      messages.push(toolResultMessage);
      opts.onMessage?.(toolResultMessage);
    } catch (err) {
      if (isCancel(err)) {
        yield { type: 'turn_end', stopReason: 'cancelled' };
        return;
      }
      yield { type: 'error', error: toAppError(err) };
      return;
    }
  }
}
