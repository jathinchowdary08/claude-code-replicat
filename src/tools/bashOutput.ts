import { z } from 'zod';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  bash_id: z.string().describe('The id of the background shell (returned by Bash run_in_background).'),
  filter: z.string().optional().describe('Optional regex; only output lines matching it are returned.'),
});

type Input = z.infer<typeof schema>;

export const bashOutputTool: Tool<Input> = {
  name: 'BashOutput',
  schema,
  readOnly: true,
  description: [
    'Read new output from a background shell since the last read. Returns stdout/stderr',
    'produced since you last checked, plus the run status. Optionally filter lines by regex.',
  ].join(' '),
  prompt: (i) => `BashOutput ${i.bash_id}`,
  async run(input, ctx) {
    let filter: RegExp | undefined;
    if (input.filter) {
      try {
        filter = new RegExp(input.filter);
      } catch {
        return errorResult(`Invalid filter regex: ${input.filter}`);
      }
    }
    const chunk = ctx.shells.readNew(input.bash_id, filter);
    if (!chunk) return errorResult(`No background shell with id ${input.bash_id}.`);

    const parts: string[] = [];
    if (chunk.stdout.trim()) parts.push(chunk.stdout.replace(/\s+$/, ''));
    if (chunk.stderr.trim()) parts.push(`[stderr]\n${chunk.stderr.replace(/\s+$/, '')}`);
    let body = parts.join('\n');
    if (!body) body = '[no new output]';
    body += `\n[status: ${chunk.status}${chunk.exitCode !== null ? `, exit ${chunk.exitCode}` : ''}]`;

    return textResult(body, { title: `BashOutput ${input.bash_id} (${chunk.status})` });
  },
};
