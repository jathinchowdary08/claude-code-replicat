/** Typed events streamed by the agent loop, consumed by both the TUI and print mode. */
import type { AppError } from '../util/errors.js';
import type { Tool, ToolResult } from '../tools/types.js';
import type { UsageTotals } from '../llm/tokens.js';

export type AgentEvent =
  | { type: 'assistant_text'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'tool_request'; id: string; name: string; input: unknown; title: string }
  | { type: 'tool_result'; id: string; name: string; result: ToolResult }
  | { type: 'tool_denied'; id: string; name: string; reason: string }
  | { type: 'usage'; usage: UsageTotals; cost: number }
  | { type: 'turn_end'; stopReason: string | null }
  | { type: 'error'; error: AppError };

/** A request to the UI to confirm a tool call that the engine marked "ask". */
export interface PermissionRequest {
  tool: Tool;
  input: unknown;
  title: string;
}

export interface PermissionResolution {
  behavior: 'allow' | 'deny';
  /** Remember this decision for the rest of the session. */
  always?: boolean;
  /** Whether "always" applies to the whole tool or just this target. */
  scope?: 'tool' | 'target';
  /** Optional message surfaced to the model when denied. */
  message?: string;
}

export type ConfirmPermission = (req: PermissionRequest) => Promise<PermissionResolution>;
