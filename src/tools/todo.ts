import { z } from 'zod';
import { textResult, type Tool } from './types.js';

const todoItem = z.object({
  content: z.string().describe('The task description (imperative).'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string().optional().describe('Present-continuous form shown while in progress.'),
});

const schema = z.object({
  todos: z.array(todoItem).describe('The full, updated todo list (replaces the previous list).'),
});

type Input = z.infer<typeof schema>;

const MARK: Record<string, string> = { completed: '[x]', in_progress: '[~]', pending: '[ ]' };

export const todoWriteTool: Tool<Input> = {
  name: 'TodoWrite',
  schema,
  readOnly: true,
  description: [
    'Create and update a structured task list for the current work. Send the complete',
    'list each time. Use it to plan multi-step tasks and show progress; mark exactly one',
    'task in_progress at a time and complete tasks as you finish them.',
  ].join(' '),
  prompt: () => 'Update todos',
  async run(input, ctx) {
    ctx.todos.length = 0;
    ctx.todos.push(...input.todos);

    const lines = input.todos.map((t) => `${MARK[t.status] ?? '[ ]'} ${t.content}`);
    const done = input.todos.filter((t) => t.status === 'completed').length;
    return textResult(lines.join('\n') || '(no todos)', {
      title: `Todos (${done}/${input.todos.length} done)`,
      ui: { kind: 'list', items: lines },
    });
  },
};
