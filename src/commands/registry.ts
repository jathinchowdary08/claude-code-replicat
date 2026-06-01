/**
 * The slash-command registry: combines built-ins, file-backed custom commands,
 * and a generated `/help`. Resolves names/aliases, suggests completions for the
 * autocomplete menu, and dispatches an input line to a {@link CommandResult}.
 */
import { builtinCommands } from './builtins.js';
import { loadCustomCommands } from './custom.js';
import { parseSlashCommand } from './parse.js';
import type { CommandContext, CommandResult, SlashCommand } from './types.js';

export interface CommandRegistry {
  commands: SlashCommand[];
  get(name: string): SlashCommand | undefined;
  /** Commands whose name/alias starts with `prefix` (leading slash optional). */
  suggest(prefix: string): SlashCommand[];
  /** Dispatch a full input line; null when it is not a slash command. */
  run(input: string, ctx: CommandContext): Promise<CommandResult | null>;
}

function formatHelp(commands: SlashCommand[]): string {
  const width = Math.max(...commands.map((c) => c.name.length));
  const lines = commands
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const alias = c.aliases?.length ? ` (/${c.aliases.join(', /')})` : '';
      return `  /${c.name.padEnd(width)}  ${c.description}${alias}`;
    });
  return `Available commands:\n${lines.join('\n')}`;
}

export function buildCommandRegistry(cwd: string): CommandRegistry {
  const base = [...builtinCommands, ...loadCustomCommands(cwd)];

  const helpCommand: SlashCommand = {
    name: 'help',
    aliases: ['?'],
    description: 'Show this help',
    source: 'builtin',
    run: () => ({ kind: 'message', text: formatHelp([helpCommand, ...base]) }),
  };

  const commands = [helpCommand, ...base];
  const byName = new Map<string, SlashCommand>();
  for (const cmd of commands) {
    if (!byName.has(cmd.name)) byName.set(cmd.name, cmd);
    for (const alias of cmd.aliases ?? []) {
      if (!byName.has(alias)) byName.set(alias, cmd);
    }
  }

  function get(name: string): SlashCommand | undefined {
    return byName.get(name.replace(/^\//, '').toLowerCase());
  }

  function suggest(prefix: string): SlashCommand[] {
    const p = prefix.replace(/^\//, '').toLowerCase();
    const seen = new Set<string>();
    const out: SlashCommand[] = [];
    for (const [key, cmd] of byName) {
      if (!key.startsWith(p)) continue;
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      out.push(cmd);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function run(input: string, ctx: CommandContext): Promise<CommandResult | null> {
    const parsed = parseSlashCommand(input);
    if (!parsed) return null;
    const cmd = get(parsed.name);
    if (!cmd) {
      return { kind: 'message', text: `Unknown command: /${parsed.name}. Type /help for a list.` };
    }
    return cmd.run(parsed.args, ctx);
  }

  return { commands, get, suggest, run };
}
