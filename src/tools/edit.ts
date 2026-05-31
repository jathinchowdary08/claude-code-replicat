import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { createPatch } from 'diff';
import { atomicWrite } from '../util/fs.js';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  file_path: z.string().describe('Path to the file to edit.'),
  old_string: z.string().describe('The exact text to replace (must match the file precisely).'),
  new_string: z.string().describe('The replacement text. Must differ from old_string.'),
  replace_all: z
    .boolean()
    .optional()
    .default(false)
    .describe('Replace every occurrence. Otherwise old_string must be unique.'),
});

type Input = z.infer<typeof schema>;

export const editTool: Tool<Input> = {
  name: 'Edit',
  schema,
  readOnly: false,
  description: [
    'Make an exact string replacement in a file. You MUST Read the file first.',
    '`old_string` must match the file exactly (including whitespace) and be unique,',
    'unless `replace_all` is true. Fails if old_string is absent or ambiguous —',
    'add surrounding context to disambiguate.',
  ].join(' '),
  prompt: (i) => `Edit ${i.file_path}`,
  async run(input, ctx) {
    const abs = ctx.sandbox.resolve(input.file_path, ctx.cwd);
    const rel = relative(ctx.cwd, abs) || abs;

    if (input.old_string === input.new_string) {
      return errorResult('old_string and new_string are identical — nothing to change.');
    }
    if (!ctx.readFiles.has(abs)) {
      return errorResult(`You must Read ${rel} before editing it.`);
    }

    const content = await readFile(abs, 'utf8').catch(() => null);
    if (content === null) return errorResult(`File not found: ${rel}`);

    const occurrences = content.split(input.old_string).length - 1;
    if (occurrences === 0) {
      return errorResult(`old_string not found in ${rel}.`);
    }
    if (occurrences > 1 && !input.replace_all) {
      return errorResult(
        `old_string is not unique in ${rel} (${occurrences} matches). Add more context or set replace_all.`,
      );
    }

    let updated: string;
    if (input.replace_all) {
      updated = content.split(input.old_string).join(input.new_string);
    } else {
      const idx = content.indexOf(input.old_string);
      updated = content.slice(0, idx) + input.new_string + content.slice(idx + input.old_string.length);
    }

    await atomicWrite(abs, updated);

    const patch = createPatch(rel, content, updated, '', '');
    const count = input.replace_all ? `${occurrences} replacement${occurrences === 1 ? '' : 's'}` : '1 replacement';
    return textResult(`Edited ${rel} (${count})`, {
      title: `Edited ${rel} (${count})`,
      ui: { kind: 'diff', patch },
    });
  },
};
