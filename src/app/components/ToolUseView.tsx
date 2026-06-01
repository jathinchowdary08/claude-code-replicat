import React from 'react';
import { Box, Text } from 'ink';
import type { ToolResult } from '../../tools/types.js';
import { DiffView } from './DiffView.js';
import { toolSummaryLines } from '../format.js';

export interface ToolItem {
  id: string;
  name: string;
  title: string;
  status: 'running' | 'done' | 'denied';
  result?: ToolResult;
  reason?: string;
}

function ResultView({ result, action }: { result: ToolResult; action: string }): React.ReactElement {
  if (result.ui?.kind === 'diff') {
    return (
      <Box marginLeft={2} flexDirection="column">
        <DiffView patch={result.ui.patch} />
      </Box>
    );
  }
  const lines = toolSummaryLines(result, action);
  return (
    <Box flexDirection="column" marginLeft={2}>
      {lines.map((line, i) => (
        <Text key={i} color={result.isError ? 'red' : 'gray'}>
          {i === 0 ? '⎿  ' : '   '}
          {line}
        </Text>
      ))}
    </Box>
  );
}

export function ToolUseView({ item }: { item: ToolItem }): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="gray">{item.title}</Text>
      </Box>
      {item.status === 'denied' && (
        <Text color="red">
          {'  ⎿  denied: '}
          {item.reason}
        </Text>
      )}
      {item.result && <ResultView result={item.result} action={item.title} />}
    </Box>
  );
}
