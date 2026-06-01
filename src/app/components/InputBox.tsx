import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { SlashCommand } from '../../commands/types.js';

interface SuggestItem {
  label: string;
  insert: string;
  hint?: string;
}

/** Derive the autocomplete menu from the current input value. */
function computeSuggestions(
  value: string,
  files: string[],
  suggestCommands: (prefix: string) => SlashCommand[],
): SuggestItem[] {
  if (value.startsWith('/') && !value.includes(' ')) {
    return suggestCommands(value.slice(1))
      .slice(0, 8)
      .map((c) => ({ label: `/${c.name}`, insert: `/${c.name} `, hint: c.description }));
  }
  const at = value.lastIndexOf('@');
  if (at >= 0) {
    const frag = value.slice(at + 1);
    if (!frag.includes(' ')) {
      const q = frag.toLowerCase();
      return files
        .filter((f) => f.toLowerCase().includes(q))
        .slice(0, 8)
        .map((f) => ({ label: `@${f}`, insert: `${value.slice(0, at + 1)}${f} ` }));
    }
  }
  return [];
}

const PLACEHOLDER = 'Type a message — / for commands, @ for files';

export function InputBox({
  onSubmit,
  disabled,
  suggestCommands,
  files,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
  suggestCommands: (prefix: string) => SlashCommand[];
  files: string[];
}): React.ReactElement {
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState(0);
  const history = useRef<string[]>([]);
  const histIdx = useRef<number>(-1);

  // Track the terminal width so the box always spans the full width (and reflows on resize).
  const { stdout } = useStdout();
  const [cols, setCols] = useState<number>(stdout?.columns ?? 80);
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setCols(stdout.columns ?? 80);
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  const items = useMemo(
    () => computeSuggestions(value, files, suggestCommands),
    [value, files, suggestCommands],
  );
  const menuOpen = !disabled && items.length > 0;
  const sel = Math.min(selected, Math.max(0, items.length - 1));

  useEffect(() => {
    setSelected(0);
  }, [value]);

  const complete = () => {
    const it = items[sel];
    if (it) setValue(it.insert);
  };

  useInput(
    (input, key) => {
      if (key.tab && !key.shift) {
        if (menuOpen) complete();
        return;
      }
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
        if (menuOpen) {
          setSelected((s) => Math.max(0, s - 1));
          return;
        }
        const h = history.current;
        if (h.length === 0) return;
        histIdx.current = histIdx.current < 0 ? h.length - 1 : Math.max(0, histIdx.current - 1);
        setValue(h[histIdx.current] ?? '');
        return;
      }
      if (key.downArrow) {
        if (menuOpen) {
          setSelected((s) => Math.min(items.length - 1, s + 1));
          return;
        }
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
      if (key.ctrl || key.meta || key.escape) return;
      if (input) setValue((v) => v + input);
    },
    { isActive: !disabled },
  );

  return (
    <Box flexDirection="column" width={cols}>
      <Box borderStyle="round" borderColor={disabled ? 'gray' : 'cyan'} paddingX={1} width={cols}>
        <Text color={disabled ? 'gray' : 'cyan'}>{'> '}</Text>
        {disabled ? (
          <Text color="gray">working… (esc to interrupt)</Text>
        ) : value ? (
          <Text>
            {value}
            <Text inverse> </Text>
          </Text>
        ) : (
          <Text>
            <Text inverse> </Text>
            <Text color="gray">{PLACEHOLDER}</Text>
          </Text>
        )}
      </Box>
      {menuOpen && (
        <Box flexDirection="column" marginLeft={2}>
          {items.map((it, i) => (
            <Text key={it.label} color={i === sel ? 'cyan' : 'gray'}>
              {(i === sel ? '❯ ' : '  ') + it.label}
              {it.hint ? `  — ${it.hint}` : ''}
            </Text>
          ))}
          <Text color="gray">  ↑↓ select · tab complete</Text>
        </Box>
      )}
    </Box>
  );
}
