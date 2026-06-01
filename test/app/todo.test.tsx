import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { TodoView } from '../../src/app/components/TodoView.js';
import type { TodoItem } from '../../src/tools/types.js';

const todos: TodoItem[] = [
  { content: 'First task', status: 'completed' },
  { content: 'Second task', status: 'in_progress', activeForm: 'Doing second task' },
  { content: 'Third task', status: 'pending' },
];

describe('TodoView', () => {
  it('renders todos with a count and shows activeForm while in progress', () => {
    const { lastFrame } = render(<TodoView todos={todos} />);
    const out = lastFrame() ?? '';
    expect(out).toContain('Todos (1/3)');
    expect(out).toContain('First task');
    expect(out).toContain('Doing second task');
    expect(out).toContain('Third task');
  });

  it('renders nothing when there are no todos', () => {
    const { lastFrame } = render(<TodoView todos={[]} />);
    expect(lastFrame()).toBe('');
  });
});
