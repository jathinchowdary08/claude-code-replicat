import { z } from 'zod';
import { readdir, stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  path: z.string().describe('Directory to list (absolute, or relative to the cwd).'),
  ignore: z.array(z.string()).optional().describe('Glob patterns (names) to ignore.'),
});

type Input = z.infer<typeof schema>;

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export const lsTool: Tool<Input> = {
  name: 'LS',
  schema,
  readOnly: true,
  description: [
    'List the contents of a directory. Directories are suffixed with "/". Use the',
    '`ignore` patterns to hide entries. Prefer Glob when searching for files by pattern.',
  ].join(' '),
  prompt: (i) => `LS ${i.path}`,
  async run(input, ctx) {
    const abs = ctx.sandbox.resolve(input.path, ctx.cwd);
    const st = await stat(abs).catch(() => null);
    if (!st) return errorResult(`Directory not found: ${input.path}`);
    if (!st.isDirectory()) return errorResult(`Not a directory: ${input.path}`);

    const ignoreRes = (input.ignore ?? []).map(globToRegExp);
    const entries = await readdir(abs, { withFileTypes: true });

    const filtered = entries.filter((e) => !ignoreRes.some((re) => re.test(e.name)));
    filtered.sort((a, b) => {
      const ad = a.isDirectory() ? 0 : 1;
      const bd = b.isDirectory() ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name);
    });

    if (filtered.length === 0) {
      return textResult('(empty directory)', { title: `LS ${input.path} — empty` });
    }

    const lines = filtered.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    const rel = relative(ctx.cwd, abs) || '.';
    return textResult(lines.join('\n'), {
      title: `LS ${rel} — ${filtered.length} item${filtered.length === 1 ? '' : 's'}`,
      ui: { kind: 'list', items: lines },
    });
  },
};
