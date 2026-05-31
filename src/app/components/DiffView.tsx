import React from 'react';
import { Box, Text } from 'ink';

/** Render a unified diff patch with colored add/remove lines. */
export function DiffView({ patch, maxLines = 16 }: { patch: string; maxLines?: number }): React.ReactElement {
  const all = patch.split('\n').filter((l, i) => !(i < 4 && (l.startsWith('===') || l.startsWith('Index') || l.startsWith('---') || l.startsWith('+++'))));
  const shown = all.slice(0, maxLines);
  const hiddenCount = all.length - shown.length;

  return (
    <Box flexDirection="column">
      {shown.map((line, i) => {
        let color: string | undefined;
        if (line.startsWith('+')) color = 'green';
        else if (line.startsWith('-')) color = 'red';
        else if (line.startsWith('@@')) color = 'cyan';
        else color = 'gray';
        return (
          <Text key={i} color={color}>
            {line || ' '}
          </Text>
        );
      })}
      {hiddenCount > 0 && <Text color="gray">… (+{hiddenCount} more diff lines)</Text>}
    </Box>
  );
}
