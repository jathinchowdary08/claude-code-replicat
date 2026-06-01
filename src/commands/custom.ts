/**
 * Custom, file-backed slash commands. Any `*.md` under `<cwd>/.agent/commands/`
 * or `~/.agent/commands/` becomes a `/name` command whose body is a prompt sent
 * to the agent. `$ARGUMENTS` in the body is replaced with the command's arguments
 * (if the placeholder is absent, arguments are appended). An optional YAML-ish
 * frontmatter block may set `description:`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { projectConfigDir, userConfigDir } from '../config/paths.js';
import type { SlashCommand } from './types.js';

export function commandDirs(cwd: string): string[] {
  return [join(userConfigDir(), 'commands'), join(projectConfigDir(cwd), 'commands')];
}

interface ParsedFile {
  description?: string;
  body: string;
}

export function parseCommandFile(raw: string): ParsedFile {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fm) return { body: raw.trim() };
  const front = fm[1] ?? '';
  const body = (fm[2] ?? '').trim();
  const descMatch = front.match(/^description:\s*(.+)$/im);
  const description = descMatch ? descMatch[1]!.trim().replace(/^["']|["']$/g, '') : undefined;
  return { description, body };
}

export function applyArguments(body: string, args: string): string {
  if (body.includes('$ARGUMENTS')) return body.split('$ARGUMENTS').join(args);
  return args ? `${body}\n\n${args}` : body;
}

/** Load custom commands; project commands override user commands of the same name. */
export function loadCustomCommands(cwd: string): SlashCommand[] {
  const byName = new Map<string, SlashCommand>();
  for (const dir of commandDirs(cwd)) {
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of entries) {
      if (!file.toLowerCase().endsWith('.md')) continue;
      const name = basename(file, '.md').toLowerCase();
      let raw: string;
      try {
        raw = readFileSync(join(dir, file), 'utf8');
      } catch {
        continue;
      }
      const { description, body } = parseCommandFile(raw);
      byName.set(name, {
        name,
        description: description ?? `Custom command (${file})`,
        source: 'custom',
        run: (args) => ({ kind: 'prompt', text: applyArguments(body, args) }),
      });
    }
  }
  return [...byName.values()];
}
