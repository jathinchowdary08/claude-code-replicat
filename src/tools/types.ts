/**
 * The Tool abstraction. Each tool declares a zod input schema (converted to the
 * Anthropic tool schema in the registry), a read-only flag (informs permissions),
 * and a `run` that executes against a shared {@link ToolContext}.
 */
import type { z } from 'zod';
import type { PathSandbox } from '../util/fs.js';
import type { ShellManager } from './shellManager.js';

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  content: string;
  status: TodoStatus;
  activeForm?: string;
}

/** An image returned by a tool (e.g. Read on a PNG), forwarded to the model. */
export interface ToolImage {
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  /** Base64-encoded image data. */
  data: string;
}

/** Optional richer hint so the TUI can render diffs, lists, etc. */
export type ToolUiHint =
  | { kind: 'diff'; patch: string }
  | { kind: 'text' }
  | { kind: 'list'; items: string[] };

export interface ToolResult {
  /** Text returned to the model as the tool_result content. */
  output: string;
  isError?: boolean;
  images?: ToolImage[];
  /** One-line human summary for the TUI (e.g. "Updated src/foo.ts (+3 -1)"). */
  title?: string;
  ui?: ToolUiHint;
}

export type SubagentRunner = (opts: {
  description: string;
  prompt: string;
  signal: AbortSignal;
}) => Promise<string>;

/** Shared, mutable state passed to every tool invocation in a session. */
export interface ToolContext {
  /** Current working directory (Bash `cd` persists here). */
  cwd: string;
  /** Confines all file access to the allowed roots. */
  sandbox: PathSandbox;
  /** Realpaths the agent has Read this session (Edit/Write require a prior Read). */
  readFiles: Set<string>;
  /** Live todo list (TodoWrite mutates; the UI renders it). */
  todos: TodoItem[];
  /** Background shell registry. */
  shells: ShellManager;
  /** Spawn a bounded subagent (wired by the app to avoid an import cycle). */
  spawnSubagent?: SubagentRunner;
  /** Called by ExitPlanMode to present a plan and request leaving plan mode. */
  requestPlanExit?: (plan: string) => Promise<boolean>;
  /** True while the session is in read-only plan mode. */
  planMode: boolean;
}

export interface Tool<I = any> {
  name: string;
  description: string;
  schema: z.ZodType<I>;
  /** Read-only tools are auto-allowed by the permission engine. */
  readOnly: boolean;
  /** Short human label for the permission prompt / tool view. */
  prompt?(input: I): string;
  run(input: I, ctx: ToolContext, signal: AbortSignal): Promise<ToolResult>;
}

/** Convenience constructors. */
export function textResult(output: string, extra?: Partial<ToolResult>): ToolResult {
  return { output, ...extra };
}

export function errorResult(message: string, extra?: Partial<ToolResult>): ToolResult {
  return { output: message, isError: true, ...extra };
}
