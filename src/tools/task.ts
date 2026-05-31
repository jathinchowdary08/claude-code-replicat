import { z } from 'zod';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  description: z.string().describe('A short (3-5 word) description of the task.'),
  prompt: z.string().describe('The detailed task for the subagent to perform autonomously.'),
  subagent_type: z.string().optional().describe('Which kind of subagent to use (e.g. "explore").'),
});

type Input = z.infer<typeof schema>;

export const taskTool: Tool<Input> = {
  name: 'Task',
  schema,
  // Launching a subagent is not itself a mutation; the subagent's own tools are gated.
  readOnly: true,
  description: [
    'Launch a bounded subagent to handle a multi-step task autonomously and return only',
    'its final summary. Useful for fan-out search or isolated investigation. Give a',
    'detailed, self-contained prompt — you will not see intermediate steps.',
  ].join(' '),
  prompt: (i) => `Task: ${i.description}`,
  async run(input, ctx, signal) {
    if (!ctx.spawnSubagent) {
      return errorResult('Subagents are not available in this context.');
    }
    const result = await ctx.spawnSubagent({
      description: input.description,
      prompt: input.prompt,
      signal,
    });
    return textResult(result, { title: `Task: ${input.description}` });
  },
};
