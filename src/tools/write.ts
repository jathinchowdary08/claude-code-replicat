import { z } from 'zod';
import { readFile, stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { createPatch } from 'diff';
import { atomicWrite } from '../util/fs.js';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  file_path: z.string().describe('Path to the file to write (absolute, or relative to the cwd).'),
  content: z.string().describe('The full contents to write to the file.'),
});

type Input = z.infer<typeof schema>;

export const writeTool: Tool<Input> = {
  name: 'Write',
  schema,
  readOnly: false,
  description: [
    'Write a file to the local filesystem, creating it or overwriting it entirely.',
    'For an existing file you MUST Read it first (this prevents clobbering changes you',
    "haven't seen). Prefer Edit for changing part of a file. Writes are atomic.",
  ].join(' '),
  prompt: (i) => `Write ${i.file_path}`,
  async run(input, ctx) {
    const abs = ctx.sandbox.resolve(input.file_path, ctx.cwd);
    const rel = relative(ctx.cwd, abs) || abs;

    const st = await stat(abs).catch(() => null);
    if (st?.isDirectory()) {
      return errorResult(`Path is a directory, not a file: ${rel}`);
    }

    let oldContent = '';
    const exists = st !== null;
    if (exists) {
      if (!ctx.readFiles.has(abs)) {
        return errorResult(
          `Refusing to overwrite ${rel} because it has not been Read this session. Read it first.`,
        );
      }
      oldContent = await readFile(abs, 'utf8').catch(() => '');
    }

    await atomicWrite(abs, input.content);
    ctx.readFiles.add(abs);

    const patch = createPatch(rel, oldContent, input.content, '', '');
    const verb = exists ? 'Updated' : 'Created';
    return textResult(`${verb} ${rel}`, {
      title: `${verb} ${rel}`,
      ui: { kind: 'diff', patch },
    });
  },
};
