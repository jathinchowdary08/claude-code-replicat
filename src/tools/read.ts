import { z } from 'zod';
import { readFile, stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { isImagePath, isProbablyBinary } from '../util/fs.js';
import { errorResult, textResult, type Tool, type ToolImage } from './types.js';

const schema = z.object({
  file_path: z.string().describe('Path to the file to read (absolute, or relative to the cwd).'),
  offset: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('1-based line number to start reading from. Use with `limit` for large files.'),
  limit: z.number().int().positive().optional().describe('Maximum number of lines to read.'),
});

type Input = z.infer<typeof schema>;

const DEFAULT_LIMIT = 2000;
const MAX_LINE_LEN = 2000;

function imageMediaType(path: string): ToolImage['mediaType'] | null {
  const p = path.toLowerCase();
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.gif')) return 'image/gif';
  if (p.endsWith('.webp')) return 'image/webp';
  return null;
}

export const readTool: Tool<Input> = {
  name: 'Read',
  schema,
  readOnly: true,
  description: [
    'Read a file from the local filesystem. Returns the contents with line numbers in',
    '`cat -n` format (6-space-padded line number, a tab, then the line).',
    'Use `offset` and `limit` to page through large files. Prefer this over a shell',
    '`cat`. Images are returned to you visually. Reading a missing file or a directory',
    'is an error (use LS to list a directory).',
  ].join(' '),
  prompt: (i) => `Read ${i.file_path}`,
  async run(input, ctx) {
    const abs = ctx.sandbox.resolve(input.file_path, ctx.cwd);
    const st = await stat(abs).catch(() => null);
    if (!st) return errorResult(`File not found: ${input.file_path}`);
    if (st.isDirectory()) {
      return errorResult(`Path is a directory, not a file: ${input.file_path}. Use LS instead.`);
    }

    const buf = await readFile(abs);
    ctx.readFiles.add(abs);
    const rel = relative(ctx.cwd, abs) || abs;

    // Images: forward as a visual block.
    const media = imageMediaType(abs);
    if (media) {
      return {
        output: `[Read image ${rel} — ${buf.length} bytes]`,
        title: `Read ${rel} (image)`,
        images: [{ mediaType: media, data: buf.toString('base64') }],
      };
    }
    if (isImagePath(abs) || isProbablyBinary(buf)) {
      return errorResult(`Cannot read binary file as text: ${rel}`);
    }

    const text = buf.toString('utf8');
    if (text.length === 0) {
      return textResult('(empty file)', { title: `Read ${rel} (empty)` });
    }

    const allLines = text.split('\n');
    const start = (input.offset ?? 1) - 1;
    const limit = input.limit ?? DEFAULT_LIMIT;
    const slice = allLines.slice(start, start + limit);

    const numbered = slice
      .map((line, i) => {
        const n = start + i + 1;
        const truncated = line.length > MAX_LINE_LEN ? `${line.slice(0, MAX_LINE_LEN)}… [line truncated]` : line;
        return `${String(n).padStart(6, ' ')}\t${truncated}`;
      })
      .join('\n');

    const shown = slice.length;
    const total = allLines.length;
    const more = start + shown < total ? ` (showing ${shown} of ${total} lines)` : ` (${total} lines)`;
    return textResult(numbered, { title: `Read ${rel}${more}` });
  },
};
