import { z } from 'zod';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  shell_id: z.string().describe('The id of the background shell to terminate.'),
});

type Input = z.infer<typeof schema>;

export const killShellTool: Tool<Input> = {
  name: 'KillShell',
  schema,
  readOnly: false,
  description: 'Terminate a background shell by its id.',
  prompt: (i) => `KillShell ${i.shell_id}`,
  async run(input, ctx) {
    const ok = ctx.shells.kill(input.shell_id);
    if (!ok) return errorResult(`No background shell with id ${input.shell_id}.`);
    return textResult(`Killed background shell ${input.shell_id}.`, { title: `KillShell ${input.shell_id}` });
  },
};
