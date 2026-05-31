import React from 'react';
import { Box, Text } from 'ink';
import type { ToolResult } from '../../tools/types.js';
import { DiffView } from './DiffView.js';

export interface ToolItem {
  id: string;
  name: string;
  title: string;
  status: 'running' | 'done' | 'denied';
  result?: ToolResult;
  reason?: string;
}

function firstLines(s: string, n: number): string {
  const lines = s.split('\n');
  const head = lines.slice(0, n).join('\n');
  return lines.length > n ? `${head} …` : head;
}

function ResultView({ result }: { result: ToolResult }): React.ReactElement {
  if (result.ui?.kind === 'diff') {
    return (
      <Box marginLeft={2} flexDirection="column">
        <DiffView patch={result.ui.patch} />
      </Box>
    );
  }
  const summary = result.title ?? firstLines(result.output, 3);
  return (
    <Text color={result.isError ? 'red' : 'gray'}>
      {'  ↳ '}
      {summary}
    </Text>
  );
}

export function ToolUseView({ item }: { item: ToolItem }): React.ReactElement {
  const marker =
    item.status === 'running' ? (
      <Text color="yellow">●</Text>
    ) : item.status === 'denied' ? (
      <Text color="red">⨯</Text>
    ) : (
      <Text color="green">●</Text>
    );

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        {marker}
        <Text bold> {item.name}</Text>
        <Text color="gray"> {item.title}</Text>
      </Box>
      {item.status === 'denied' && <Text color="red">{'  ↳ denied: '}{item.reason}</Text>}
      {item.result && <ResultView result={item.result} />}
    </Box>
  );
}
