import React from 'react';
import { Box, Text } from 'ink';
import type { HistoryItem } from '../hooks/useAgentLoop.js';
import { Markdown } from './Markdown.js';
import { ToolUseView } from './ToolUseView.js';

function Item({ item }: { item: HistoryItem }): React.ReactElement {
  switch (item.kind) {
    case 'user':
      return (
        <Box marginTop={1}>
          <Text color="blue" bold>
            {'❯ '}
          </Text>
          <Text>{item.text}</Text>
        </Box>
      );
    case 'assistant':
      return (
        <Box marginTop={1}>
          <Markdown text={item.text} />
        </Box>
      );
    case 'thinking':
      return (
        <Box marginTop={1}>
          <Text color="gray" italic>
            {item.text}
          </Text>
        </Box>
      );
    case 'tool':
      return <ToolUseView item={item} />;
    case 'error':
      return (
        <Box marginTop={1}>
          <Text color="red">{item.text}</Text>
        </Box>
      );
  }
}

export function MessageList({ items }: { items: HistoryItem[] }): React.ReactElement {
  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Item key={i} item={item} />
      ))}
    </Box>
  );
}
