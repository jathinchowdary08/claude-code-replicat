/** Built-in slash commands (everything except `/help`, which the registry adds). */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSION_MODES, isPermissionMode } from '../permissions/mode.js';
import { loadSettings } from '../config/settings.js';
import { projectSettingsPath, userSettingsPath } from '../config/paths.js';
import { addPermissionRule } from '../config/settings-write.js';
import { buildDoctorReport } from '../util/doctor.js';
import type { SlashCommand } from './types.js';

const INIT_PROMPT = [
  'Analyze this codebase and create an AGENTS.md file at the repository root.',
  'Document: how to build, run, lint, and test; the high-level architecture and key',
  'directories; and any non-obvious conventions a new contributor (or coding agent)',
  'should follow. Keep it concise. If an AGENTS.md or CLAUDE.md already exists, read',
  'it first and improve it rather than duplicating content.',
].join(' ');

export const builtinCommands: SlashCommand[] = [
  {
    name: 'clear',
    description: 'Clear the conversation history',
    source: 'builtin',
    run: () => ({ kind: 'clear' }),
  },
  {
    name: 'model',
    description: 'Switch the active model (opens a picker, or /model <id>)',
    source: 'builtin',
    run: (args) => (args ? { kind: 'set-model', model: args } : { kind: 'pick-model' }),
  },
  {
    name: 'permission-mode',
    aliases: ['mode'],
    description: `Show or set the permission mode (${PERMISSION_MODES.join(' | ')})`,
    source: 'builtin',
    run: (args, ctx) => {
      if (!args) return { kind: 'message', text: `Current permission mode: ${ctx.mode}` };
      if (!isPermissionMode(args)) {
        return {
          kind: 'message',
          text: `Unknown mode "${args}". Valid modes: ${PERMISSION_MODES.join(', ')}.`,
        };
      }
      return { kind: 'set-mode', mode: args };
    },
  },
  {
    name: 'cost',
    description: 'Show token usage and estimated cost for this session',
    source: 'builtin',
    run: (_args, ctx) => ({
      kind: 'message',
      text: ctx.costSummary?.() ?? 'Token usage and cost are shown in the status bar.',
    }),
  },
  {
    name: 'resume',
    description: 'Resume a previous session for this project',
    source: 'builtin',
    run: () => ({ kind: 'pick-session' }),
  },
  {
    name: 'init',
    description: 'Generate an AGENTS.md describing this codebase',
    source: 'builtin',
    run: () => ({ kind: 'prompt', text: INIT_PROMPT }),
  },
  {
    name: 'compact',
    description: 'Summarize and shrink the conversation context',
    source: 'builtin',
    run: () => ({ kind: 'compact' }),
  },
  {
    name: 'status',
    description: 'Show the current session status',
    source: 'builtin',
    run: (_args, ctx) => ({
      kind: 'message',
      text: [`model: ${ctx.model}`, `mode: ${ctx.mode}`, `cwd: ${ctx.cwd}`, ctx.costSummary?.() ?? '']
        .filter(Boolean)
        .join('\n'),
    }),
  },
  {
    name: 'doctor',
    description: 'Check the environment and whether the build is stale',
    source: 'builtin',
    run: (_args, ctx) => ({ kind: 'message', text: buildDoctorReport(ctx.cwd) }),
  },
  {
    name: 'permissions',
    description: 'Show or persist permission rules: /permissions [allow|deny <rule>]',
    source: 'builtin',
    run: (args, ctx) => {
      const trimmed = args.trim();
      const sub = trimmed.split(/\s+/, 1)[0];
      if (sub === 'allow' || sub === 'deny') {
        const rule = trimmed.slice(sub.length).trim();
        if (!rule) {
          return { kind: 'message', text: `Usage: /permissions ${sub} <rule>  (e.g. ${sub} Bash(npm run test:*))` };
        }
        const list = addPermissionRule(projectSettingsPath(ctx.cwd), sub, rule);
        return { kind: 'message', text: `Saved ${sub} rule "${rule}".\n${sub}: ${list.join(', ')}` };
      }
      const s = loadSettings(ctx.cwd);
      const allow = s.permissions?.allow ?? [];
      const deny = s.permissions?.deny ?? [];
      return {
        kind: 'message',
        text: [
          `permission mode: ${ctx.mode}`,
          `allow: ${allow.length ? allow.join(', ') : '(none)'}`,
          `deny:  ${deny.length ? deny.join(', ') : '(none)'}`,
        ].join('\n'),
      };
    },
  },
  {
    name: 'config',
    description: 'Show effective settings and config file paths',
    source: 'builtin',
    run: (_args, ctx) => ({
      kind: 'message',
      text: [
        `user settings:    ${userSettingsPath()}`,
        `project settings: ${projectSettingsPath(ctx.cwd)}`,
        '',
        JSON.stringify(loadSettings(ctx.cwd), null, 2),
      ].join('\n'),
    }),
  },
  {
    name: 'memory',
    description: 'Show project memory (AGENTS.md), or /memory <note> to append',
    source: 'builtin',
    run: (args, ctx) => {
      const file = join(ctx.cwd, 'AGENTS.md');
      const note = args.trim();
      if (note) {
        appendFileSync(file, `\n- ${note}\n`);
        return { kind: 'message', text: `Added to AGENTS.md: ${note}` };
      }
      try {
        const preview = readFileSync(file, 'utf8').split('\n').slice(0, 12).join('\n');
        return { kind: 'message', text: `${file}\n\n${preview}` };
      } catch {
        return {
          kind: 'message',
          text: `No AGENTS.md yet at ${file}. Use /memory <note> (or the # prefix) to add one, or /init to generate it.`,
        };
      }
    },
  },
  {
    name: 'quit',
    aliases: ['exit'],
    description: 'Exit the app',
    source: 'builtin',
    run: () => ({ kind: 'quit' }),
  },
];
