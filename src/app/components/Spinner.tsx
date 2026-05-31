import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

export function Spinner({ label }: { label: string }): React.ReactElement {
  return (
    <Box>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      <Text color="gray"> {label}</Text>
    </Box>
  );
}
