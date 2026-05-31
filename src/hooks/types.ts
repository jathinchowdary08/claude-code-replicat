export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'SessionStart' | 'Stop';

export interface HookConfig {
  /** For tool events, a regex matched against the tool name. */
  matcher?: string;
  /** Shell command to run; receives the JSON payload on stdin. */
  command: string;
  /** Per-hook timeout in ms (default 30000). */
  timeout?: number;
}

export type HooksConfig = Partial<Record<HookEvent, HookConfig[]>>;

export interface HookOutcome {
  /** PreToolUse only: block the tool call. */
  block: boolean;
  /** Feedback surfaced to the user / model. */
  reason?: string;
}
