/** Factory for the Task tool's subagent runner: a bounded, read-only nested agent. */
import type Anthropic from '@anthropic-ai/sdk';
import { runAgent } from './loop.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { buildRegistry } from '../tools/registry.js';
import { subagentTools } from '../tools/index.js';
import { PermissionEngine } from '../permissions/engine.js';
import { HookRunner } from '../hooks/runner.js';
import { ShellManager } from '../tools/shellManager.js';
import type { PathSandbox } from '../util/fs.js';
import type { SubagentRunner, ToolContext } from '../tools/types.js';

export interface SubagentDeps {
  client: Anthropic;
  model: string;
  cwd: string;
  sandbox: PathSandbox;
  projectContext?: string;
  maxTurns?: number;
}

export function makeSubagentRunner(deps: SubagentDeps): SubagentRunner {
  return async ({ description, prompt, signal }) => {
    const registry = buildRegistry(subagentTools());
    const ctx: ToolContext = {
      cwd: deps.cwd,
      sandbox: deps.sandbox,
      readFiles: new Set(),
      todos: [],
      shells: new ShellManager(),
      planMode: false,
    };
    const system = buildSystemPrompt({
      cwd: deps.cwd,
      model: deps.model,
      planMode: false,
      projectContext: deps.projectContext,
      subagent: true,
    });
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `Task: ${description}\n\n${prompt}` },
    ];

    let out = '';
    for await (const ev of runAgent({
      client: deps.client,
      model: deps.model,
      system,
      registry,
      messages,
      signal,
      permissions: new PermissionEngine({ mode: 'bypassPermissions' }),
      hooks: new HookRunner({}, deps.cwd),
      ctx,
      confirmPermission: async () => ({ behavior: 'allow' }),
      maxTurns: deps.maxTurns ?? 16,
    })) {
      if (ev.type === 'assistant_text') out += ev.delta;
      else if (ev.type === 'error') throw ev.error;
    }
    return out.trim() || '(subagent produced no output)';
  };
}
