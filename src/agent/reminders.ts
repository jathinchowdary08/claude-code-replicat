/** Builds <system-reminder> text injected alongside tool results (e.g. todo state). */
import type { ToolContext } from '../tools/types.js';

const MARK: Record<string, string> = { completed: '[x]', in_progress: '[~]', pending: '[ ]' };

export function buildReminders(ctx: ToolContext): string | null {
  const parts: string[] = [];

  if (ctx.todos.length > 0) {
    const list = ctx.todos.map((t) => `${MARK[t.status] ?? '[ ]'} ${t.content}`).join('\n');
    const allDone = ctx.todos.every((t) => t.status === 'completed');
    parts.push(
      allDone
        ? `Your todo list is complete:\n${list}`
        : `Your current todo list (keep it updated as you work):\n${list}`,
    );
  }

  if (parts.length === 0) return null;
  return `<system-reminder>\n${parts.join('\n\n')}\n</system-reminder>`;
}
