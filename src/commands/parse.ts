/** Parsing helpers for slash-command input. */

export interface ParsedCommand {
  name: string;
  args: string;
}

/**
 * Parse a prompt line into a slash command. Returns null when the input is not a
 * slash command (so the caller sends it to the agent as an ordinary message).
 * A lone `/` is treated as not-a-command.
 */
export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('/')) return null;
  const match = trimmed.slice(1).match(/^(\S+)\s*([\s\S]*)$/);
  if (!match) return null;
  return { name: match[1]!.toLowerCase(), args: match[2]!.trim() };
}

/** True if the input looks like the user is typing a slash command. */
export function isSlashCommand(input: string): boolean {
  return input.trimStart().startsWith('/');
}
