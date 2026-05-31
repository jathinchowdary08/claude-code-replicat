import { z } from 'zod';
import { textResult, type Tool } from './types.js';

const schema = z.object({
  plan: z.string().describe('The implementation plan (markdown) to present for approval.'),
});

type Input = z.infer<typeof schema>;

export const exitPlanModeTool: Tool<Input> = {
  name: 'ExitPlanMode',
  schema,
  readOnly: true,
  description: [
    'Use when you are in plan mode and have finished planning. Presents your plan and',
    'asks the user to approve leaving plan mode to begin executing. Only for tasks that',
    'require writing code — not for read-only research.',
  ].join(' '),
  prompt: () => 'Present plan for approval',
  async run(input, ctx) {
    if (!ctx.planMode) {
      return textResult('Not currently in plan mode; nothing to exit.');
    }
    if (ctx.requestPlanExit) {
      const approved = await ctx.requestPlanExit(input.plan);
      return textResult(
        approved
          ? 'User approved the plan. Plan mode is now off — you may begin implementing.'
          : 'User did not approve the plan yet. Keep refining or wait for further instruction.',
      );
    }
    return textResult(input.plan);
  },
};
