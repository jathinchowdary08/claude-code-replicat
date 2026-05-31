import React from 'react';
import { Box, Text } from 'ink';
import { basename } from 'node:path';
import { resolveModel } from '../../llm/models.js';
import { MODE_LABEL, type PermissionMode } from '../../permissions/mode.js';
import { totalTokens, type UsageTotals } from '../../llm/tokens.js';

export function StatusBar(props: {
  model: string;
  cwd: string;
  mode: PermissionMode;
  usage: UsageTotals;
  cost: number;
}): React.ReactElement {
  const m = resolveModel(props.model);
  const modeColor = props.mode === 'bypassPermissions' ? 'red' : props.mode === 'plan' ? 'yellow' : 'green';
  return (
    <Box marginTop={1}>
      <Text color="gray">
        {m.label} · {basename(props.cwd) || props.cwd} · </Text>
      <Text color={modeColor}>{MODE_LABEL[props.mode]}</Text>
      <Text color="gray">
        {' '}· {totalTokens(props.usage).toLocaleString()} tok · ${props.cost.toFixed(4)}
      </Text>
    </Box>
  );
}
