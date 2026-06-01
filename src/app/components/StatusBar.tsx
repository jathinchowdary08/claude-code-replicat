import React from 'react';
import { Box, Text } from 'ink';
import { basename } from 'node:path';
import { resolveModel } from '../../llm/models.js';
import { MODE_LABEL, type PermissionMode } from '../../permissions/mode.js';
import { totalTokens, type UsageTotals } from '../../llm/tokens.js';
import { colors } from '../theme.js';
import { contextLeftPct } from '../format.js';

export function StatusBar({
  model,
  cwd,
  mode,
  usage,
  cost,
  contextTokens,
}: {
  model: string;
  cwd: string;
  mode: PermissionMode;
  usage: UsageTotals;
  cost: number;
  contextTokens: number;
}): React.ReactElement {
  const m = resolveModel(model);
  const modeColor =
    mode === 'bypassPermissions'
      ? 'red'
      : mode === 'plan'
        ? 'yellow'
        : mode === 'acceptEdits'
          ? 'green'
          : colors.dim;
  const left = contextLeftPct(contextTokens, m.contextWindow);

  return (
    <Box marginTop={1}>
      <Text color={colors.dim}>
        {m.label} · {basename(cwd) || cwd} ·{' '}
      </Text>
      <Text color={modeColor}>{MODE_LABEL[mode]}</Text>
      <Text color={colors.dim}>
        {' '}· {left}% context · {totalTokens(usage).toLocaleString()} tok · ${cost.toFixed(4)}
      </Text>
    </Box>
  );
}
