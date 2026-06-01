/**
 * Assembles a ready-to-run session: client, model, system prompt, tool registry,
 * permission engine, hooks, and the shared ToolContext (with subagent support).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from './llm/client.js';
import { DEFAULT_MODEL } from './llm/models.js';
import { coreTools } from './tools/index.js';
import { buildRegistry, type ToolRegistry } from './tools/registry.js';
import { ShellManager } from './tools/shellManager.js';
import type { ToolContext } from './tools/types.js';
import { PermissionEngine } from './permissions/engine.js';
import type { PermissionMode } from './permissions/mode.js';
import { HookRunner } from './hooks/runner.js';
import type { HooksConfig } from './hooks/types.js';
import { loadSettings } from './config/settings.js';
import { loadProjectContext } from './context/project.js';
import { PathSandbox } from './util/fs.js';
import { buildSystemPrompt } from './agent/systemPrompt.js';
import { makeSubagentRunner } from './agent/subagent.js';
import { openSession, type SessionStore } from './session/store.js';

export interface RuntimeOptions {
  cwd: string;
  addDirs?: string[];
  model?: string;
  permissionMode?: PermissionMode;
  /** Resume a specific session id. */
  resume?: string;
  /** Resume the latest session for this project. */
  continueSession?: boolean;
}

export interface Runtime {
  client: Anthropic;
  model: string;
  system: string;
  registry: ToolRegistry;
  permissions: PermissionEngine;
  hooks: HookRunner;
  ctx: ToolContext;
  sandbox: PathSandbox;
  mode: PermissionMode;
  /** The transcript for this run; messages are appended as the conversation grows. */
  session: SessionStore;
  /** Prior messages when resuming (empty for a fresh session). */
  initialMessages: Anthropic.MessageParam[];
  /** True when a prior transcript was reopened. */
  resumed: boolean;
  /** Extended-thinking budget in tokens (undefined = disabled). */
  thinkingBudget?: number;
}

export function createRuntime(opts: RuntimeOptions): Runtime {
  const settings = loadSettings(opts.cwd);
  const model = opts.model ?? settings.model ?? DEFAULT_MODEL;
  const mode: PermissionMode = opts.permissionMode ?? (settings.permissionMode as PermissionMode) ?? 'default';
  const addDirs = opts.addDirs ?? [];
  const thinkingBudget = settings.thinking?.budgetTokens ?? (settings.thinking?.enabled ? 4096 : undefined);

  const { store: session, messages: initialMessages, resumed } = openSession(opts.cwd, {
    resume: opts.resume,
    continueLatest: opts.continueSession,
    model,
  });

  const sandbox = new PathSandbox([opts.cwd, ...addDirs]);
  const projectContext = loadProjectContext(opts.cwd, addDirs);
  const client = createClient();

  const ctx: ToolContext = {
    cwd: opts.cwd,
    sandbox,
    readFiles: new Set(),
    todos: [],
    shells: new ShellManager(),
    planMode: mode === 'plan',
  };
  ctx.spawnSubagent = makeSubagentRunner({ client, model, cwd: opts.cwd, sandbox, projectContext });

  const system = buildSystemPrompt({ cwd: opts.cwd, model, planMode: mode === 'plan', projectContext });
  const registry = buildRegistry(coreTools);
  const permissions = new PermissionEngine({
    mode,
    allow: settings.permissions?.allow,
    deny: settings.permissions?.deny,
  });
  const hooks = new HookRunner((settings.hooks ?? {}) as HooksConfig, opts.cwd);

  return { client, model, system, registry, permissions, hooks, ctx, sandbox, mode, session, initialMessages, resumed, thinkingBudget };
}
