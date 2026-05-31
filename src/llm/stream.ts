/**
 * Wraps the Anthropic streaming API: yields text/thinking deltas as they arrive and
 * returns the final assembled message (with tool_use blocks and usage).
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { ApiToolSchema } from '../tools/registry.js';
import { isCancel, LLMError } from '../util/errors.js';

export type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string };

export interface StreamParams {
  client: Anthropic;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: ApiToolSchema[];
  maxTokens: number;
  signal: AbortSignal;
  thinkingBudget?: number;
}

type StreamBody = Parameters<Anthropic['messages']['stream']>[0];

export async function* streamAssistant(
  params: StreamParams,
): AsyncGenerator<StreamChunk, Anthropic.Message, void> {
  const body = {
    model: params.model,
    max_tokens: params.maxTokens,
    // Array form lets us attach a cache breakpoint to the (large, stable) system prompt.
    system: [{ type: 'text', text: params.system, cache_control: { type: 'ephemeral' } }],
    messages: params.messages,
    tools: params.tools,
    ...(params.thinkingBudget
      ? { thinking: { type: 'enabled', budget_tokens: params.thinkingBudget } }
      : {}),
  } as unknown as StreamBody;

  const stream = params.client.messages.stream(body, { signal: params.signal });

  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield { type: 'text', text: delta.text };
        } else if (delta.type === 'thinking_delta') {
          yield { type: 'thinking', text: delta.thinking };
        }
      }
    }
    return await stream.finalMessage();
  } catch (err) {
    if (isCancel(err)) throw err;
    const e = err as { status?: number; message?: string };
    throw new LLMError(e?.message ?? 'Streaming request failed', { status: e?.status, cause: err });
  }
}
