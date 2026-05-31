import { z } from 'zod';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { isProbablyBinary } from '../util/fs.js';
import { loadIgnorePatterns } from '../context/gitignore.js';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  pattern: z.string().describe('Regular expression to search for (JS/ripgrep-style syntax).'),
  path: z.string().optional().describe('File or directory to search in (defaults to cwd).'),
  glob: z.string().optional().describe('Glob to filter files, e.g. "*.ts".'),
  type: z.string().optional().describe('File type filter: js, ts, py, go, rust, java, json, md, …'),
  output_mode: z
    .enum(['content', 'files_with_matches', 'count'])
    .optional()
    .default('files_with_matches')
    .describe('content = matching lines; files_with_matches = paths; count = per-file counts.'),
  '-i': z.boolean().optional().describe('Case-insensitive.'),
  '-n': z.boolean().optional().describe('Show line numbers (content mode).'),
  '-A': z.number().int().nonnegative().optional().describe('Lines of context after each match.'),
  '-B': z.number().int().nonnegative().optional().describe('Lines of context before each match.'),
  '-C': z.number().int().nonnegative().optional().describe('Lines of context before and after.'),
  multiline: z.boolean().optional().describe('Let the pattern span lines (dotall).'),
  head_limit: z.number().int().positive().optional().describe('Limit the number of results.'),
});

type Input = z.infer<typeof schema>;

const IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**'];
const MAX_FILES = 5000;

const TYPE_GLOBS: Record<string, string[]> = {
  js: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
  ts: ['**/*.ts', '**/*.tsx'],
  py: ['**/*.py'],
  go: ['**/*.go'],
  rust: ['**/*.rs'],
  java: ['**/*.java'],
  c: ['**/*.c', '**/*.h'],
  cpp: ['**/*.cpp', '**/*.hpp', '**/*.cc', '**/*.hh'],
  json: ['**/*.json'],
  md: ['**/*.md', '**/*.markdown'],
};

function buildRegex(pattern: string, input: Input): RegExp | null {
  let flags = 'g';
  if (input['-i']) flags += 'i';
  if (input.multiline) flags += 's';
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export const grepTool: Tool<Input> = {
  name: 'Grep',
  schema,
  readOnly: true,
  description: [
    'Search file contents with a regular expression. Defaults to listing matching files;',
    'use output_mode "content" for matching lines (with -n, -A/-B/-C context) or "count".',
    'Filter with `glob` or `type`. Prefer this over a shell grep/rg.',
  ].join(' '),
  prompt: (i) => `Grep ${i.pattern}`,
  async run(input, ctx) {
    const re = buildRegex(input.pattern, input);
    if (!re) return errorResult(`Invalid regular expression: ${input.pattern}`);

    const base = input.path ? ctx.sandbox.resolve(input.path, ctx.cwd) : ctx.cwd;
    const typeGlobs = input.type ? TYPE_GLOBS[input.type] : undefined;
    const globs: string[] = typeGlobs ?? [input.glob ?? '**/*'];

    const files: string[] = (
      await fg(globs, {
        cwd: base,
        dot: false,
        onlyFiles: true,
        absolute: true,
        suppressErrors: true,
        ignore: [...IGNORE, ...loadIgnorePatterns(base)],
      })
    ).slice(0, MAX_FILES);

    const after = input['-A'] ?? input['-C'] ?? 0;
    const before = input['-B'] ?? input['-C'] ?? 0;
    const limit = input.head_limit ?? (input.output_mode === 'content' ? 200 : 1000);

    const contentLines: string[] = [];
    const fileMatches: string[] = [];
    const counts: Array<{ file: string; n: number }> = [];

    for (const file of files) {
      const buf = await readFile(file).catch(() => null);
      if (!buf || isProbablyBinary(buf)) continue;
      const text = buf.toString('utf8');
      const rel = relative(ctx.cwd, file) || file;

      if (input.multiline) {
        re.lastIndex = 0;
        if (re.test(text)) {
          fileMatches.push(rel);
          if (input.output_mode === 'count') counts.push({ file: rel, n: 1 });
        }
        continue;
      }

      const lines = text.split('\n');
      let matchCount = 0;
      const emitted = new Set<number>();
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        if (!re.test(lines[i]!)) continue;
        matchCount++;
        if (input.output_mode === 'content') {
          for (let j = Math.max(0, i - before); j <= Math.min(lines.length - 1, i + after); j++) {
            if (emitted.has(j)) continue;
            emitted.add(j);
            const prefix = input['-n'] ? `${rel}:${j + 1}:` : `${rel}:`;
            contentLines.push(`${prefix}${lines[j]}`);
          }
        }
      }
      if (matchCount > 0) {
        fileMatches.push(rel);
        counts.push({ file: rel, n: matchCount });
      }
    }

    if (input.output_mode === 'content') {
      if (contentLines.length === 0) return textResult('No matches found.', { title: `Grep ${input.pattern} — 0` });
      const shown = contentLines.slice(0, limit);
      const more = contentLines.length > limit ? `\n… (${contentLines.length - limit} more lines)` : '';
      return textResult(shown.join('\n') + more, {
        title: `Grep ${input.pattern} — ${contentLines.length} line${contentLines.length === 1 ? '' : 's'}`,
      });
    }

    if (input.output_mode === 'count') {
      if (counts.length === 0) return textResult('No matches found.', { title: `Grep ${input.pattern} — 0` });
      const shown = counts.slice(0, limit).map((c) => `${c.file}:${c.n}`);
      return textResult(shown.join('\n'), { title: `Grep ${input.pattern} — ${counts.length} files` });
    }

    // files_with_matches
    if (fileMatches.length === 0) return textResult('No matches found.', { title: `Grep ${input.pattern} — 0` });
    const shown = fileMatches.slice(0, limit);
    const more = fileMatches.length > limit ? `\n… (${fileMatches.length - limit} more)` : '';
    return textResult(shown.join('\n') + more, {
      title: `Grep ${input.pattern} — ${fileMatches.length} file${fileMatches.length === 1 ? '' : 's'}`,
      ui: { kind: 'list', items: shown },
    });
  },
};
