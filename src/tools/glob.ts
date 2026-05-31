import { z } from 'zod';
import fg from 'fast-glob';
import { stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { loadIgnorePatterns } from '../context/gitignore.js';
import { textResult, type Tool } from './types.js';

const schema = z.object({
  pattern: z.string().describe('Glob pattern, e.g. "**/*.ts" or "src/**/*.{js,ts}".'),
  path: z.string().optional().describe('Directory to search in (defaults to the cwd).'),
});

type Input = z.infer<typeof schema>;

const LIMIT = 1000;
const IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**'];

export const globTool: Tool<Input> = {
  name: 'Glob',
  schema,
  readOnly: true,
  description: [
    'Fast file-name matching by glob pattern. Returns matching paths sorted by',
    'modification time (newest first). Use this to find files by name/extension.',
    'node_modules, .git, and dist are ignored.',
  ].join(' '),
  prompt: (i) => `Glob ${i.pattern}`,
  async run(input, ctx) {
    const base = input.path ? ctx.sandbox.resolve(input.path, ctx.cwd) : ctx.cwd;
    const matches = await fg(input.pattern, {
      cwd: base,
      dot: false,
      onlyFiles: true,
      absolute: true,
      suppressErrors: true,
      ignore: [...IGNORE, ...loadIgnorePatterns(base)],
    });

    if (matches.length === 0) {
      return textResult('No files found.', { title: `Glob ${input.pattern} — 0 matches` });
    }

    const withTimes = await Promise.all(
      matches.map(async (f) => {
        const m = await stat(f).then((s) => s.mtimeMs).catch(() => 0);
        return { f, m };
      }),
    );
    withTimes.sort((a, b) => b.m - a.m);

    const shown = withTimes.slice(0, LIMIT);
    const lines = shown.map(({ f }) => relative(ctx.cwd, f) || f);
    const suffix = matches.length > LIMIT ? `\n… (${matches.length - LIMIT} more)` : '';
    return textResult(lines.join('\n') + suffix, {
      title: `Glob ${input.pattern} — ${matches.length} match${matches.length === 1 ? '' : 'es'}`,
      ui: { kind: 'list', items: lines },
    });
  },
};
