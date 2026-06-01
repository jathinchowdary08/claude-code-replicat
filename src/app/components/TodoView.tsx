import React from 'react';
import { Box, Text } from 'ink';
import type { TodoItem, TodoStatus } from '../../tools/types.js';

const MARK: Record<TodoStatus, string> = { completed: '✔', in_progress: '▶', pending: '○' };
const COLOR: Record<TodoStatus, string> = { completed: 'green', in_progress: 'yellow', pending: 'gray' };

export function TodoView({ todos }: { todos: TodoItem[] }): React.ReactElement | null {
  if (todos.length === 0) return null;
  const done = todos.filter((t) => t.status === 'completed').length;
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text bold>
        Todos ({done}/{todos.length})
      </Text>
      {todos.map((t, i) => (
        <Text key={i} color={COLOR[t.status]}>
          {MARK[t.status]} {t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content}
        </Text>
      ))}
    </Box>
  );
}
