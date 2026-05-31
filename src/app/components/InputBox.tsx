import React, { useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';

export function InputBox({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
}): React.ReactElement {
  const [value, setValue] = useState('');
  const history = useRef<string[]>([]);
  const histIdx = useRef<number>(-1);

  useInput(
    (input, key) => {
      if (key.return) {
        const v = value;
        if (v.trim()) history.current.push(v);
        histIdx.current = -1;
        setValue('');
        onSubmit(v);
        return;
      }
      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
        return;
      }
      if (key.upArrow) {
        const h = history.current;
        if (h.length === 0) return;
        histIdx.current = histIdx.current < 0 ? h.length - 1 : Math.max(0, histIdx.current - 1);
        setValue(h[histIdx.current] ?? '');
        return;
      }
      if (key.downArrow) {
        const h = history.current;
        if (histIdx.current < 0) return;
        histIdx.current += 1;
        if (histIdx.current >= h.length) {
          histIdx.current = -1;
          setValue('');
        } else {
          setValue(h[histIdx.current] ?? '');
        }
        return;
      }
      // Ignore control/meta combos (handled globally) and non-printable input.
      if (key.ctrl || key.meta || key.escape) return;
      if (input) setValue((v) => v + input);
    },
    { isActive: !disabled },
  );

  return (
    <Box>
      <Text color={disabled ? 'gray' : 'green'}>{'❯ '}</Text>
      {disabled ? (
        <Text color="gray">working… (esc to interrupt)</Text>
      ) : (
        <Text>
          {value}
          <Text inverse> </Text>
        </Text>
      )}
    </Box>
  );
}
