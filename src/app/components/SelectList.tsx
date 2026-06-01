import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, glyphs } from '../theme.js';

export interface SelectItem {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A reusable selectable list: arrow keys + enter, number keys 1-9, esc to cancel.
 * Owns its own highlight state. Used by the model/session pickers, the permission
 * prompt, and the `/` and `@` autocomplete menus so they all look and behave alike.
 */
export function SelectList({
  title,
  items,
  onChoose,
  onCancel,
  current,
  footer,
}: {
  title?: string;
  items: SelectItem[];
  onChoose: (value: string, index: number) => void;
  onCancel?: () => void;
  current?: string;
  footer?: string;
}): React.ReactElement {
  const startIdx = current ? items.findIndex((i) => i.value === current) : 0;
  const [sel, setSel] = useState(startIdx < 0 ? 0 : startIdx);
  const clamped = Math.min(sel, Math.max(0, items.length - 1));

  useInput((input, key) => {
    if (key.upArrow) setSel((s) => Math.max(0, s - 1));
    else if (key.downArrow) setSel((s) => Math.min(items.length - 1, s + 1));
    else if (key.return) {
      const it = items[clamped];
      if (it) onChoose(it.value, clamped);
    } else if (key.escape) {
      onCancel?.();
    } else if (input.length === 1 && input >= '1' && input <= String(Math.min(9, items.length))) {
      const idx = Number(input) - 1;
      const it = items[idx];
      if (it) onChoose(it.value, idx);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.info} paddingX={1}>
      {title ? (
        <Text bold color={colors.info}>
          {title}
        </Text>
      ) : null}
      {items.length === 0 ? (
        <Text color={colors.dim}>(nothing here)</Text>
      ) : (
        items.map((it, i) => (
          <Text key={it.value} color={i === clamped ? colors.info : undefined}>
            {i === clamped ? `${glyphs.selected} ` : '  '}
            {it.label}
            {it.hint ? <Text color={colors.dim}> · {it.hint}</Text> : null}
          </Text>
        ))
      )}
      <Text color={colors.dim}>{footer ?? '↑↓ select · enter · esc'}</Text>
    </Box>
  );
}
