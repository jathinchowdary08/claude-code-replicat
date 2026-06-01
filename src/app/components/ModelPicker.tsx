import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { MODELS } from '../../llm/models.js';

const LIST = Object.values(MODELS);

export function ModelPicker({
  current,
  onSelect,
  onCancel,
}: {
  current: string;
  onSelect: (id: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const startIdx = LIST.findIndex((m) => m.id === current);
  const [sel, setSel] = useState(startIdx < 0 ? 0 : startIdx);

  useInput((_input, key) => {
    if (key.upArrow) setSel((s) => Math.max(0, s - 1));
    else if (key.downArrow) setSel((s) => Math.min(LIST.length - 1, s + 1));
    else if (key.return) onSelect(LIST[sel]!.id);
    else if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        Select a model
      </Text>
      {LIST.map((m, i) => (
        <Text key={m.id} color={i === sel ? 'cyan' : undefined}>
          {i === sel ? '❯ ' : '  '}
          {m.label}
          {m.id === current ? ' (current)' : ''} <Text color="gray">· {m.id}</Text>
        </Text>
      ))}
      <Text color="gray">↑↓ select · enter confirm · esc cancel</Text>
    </Box>
  );
}
