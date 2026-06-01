/** Built-in slash commands (everything except `/help`, which the registry adds). */
import { PERMISSION_MODES, isPermissionMode } from '../permissions/mode.js';
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
    name: 'quit',
    aliases: ['exit'],
    description: 'Exit the app',
    source: 'builtin',
    run: () => ({ kind: 'quit' }),
  },
];
