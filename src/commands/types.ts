/**
 * Slash-command system. A slash command is typed at the prompt as `/name args`
 * and is handled locally by the app (not sent to the model) — except commands
 * that expand into a prompt for the agent (e.g. `/init`, or custom `.md` commands).
 */
import type { PermissionMode } from '../permissions/mode.js';

/** The effect a command asks the app to perform. */
export type CommandResult =
  | { kind: 'prompt'; text: string } // send this text to the agent as a user turn
  | { kind: 'message'; text: string } // show a local message; do not call the agent
  | { kind: 'clear' } // reset the conversation
  | { kind: 'set-model'; model: string } // switch the active model
  | { kind: 'set-mode'; mode: PermissionMode } // switch the permission mode
  | { kind: 'pick-model' } // open the interactive model picker
  | { kind: 'pick-session' } // open the interactive resume picker
  | { kind: 'compact' } // summarize and shrink the conversation
  | { kind: 'quit' } // exit the app
  | { kind: 'noop' };

/** Read-only context handed to a command when it runs. */
export interface CommandContext {
  cwd: string;
  model: string;
  mode: PermissionMode;
  /** Render the usage/cost summary line (supplied by the app). */
  costSummary?: () => string;
  /** Resumable session ids, newest first (supplied by the app). */
  listSessions?: () => string[];
}

export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  source: 'builtin' | 'custom';
  run(args: string, ctx: CommandContext): CommandResult | Promise<CommandResult>;
}
