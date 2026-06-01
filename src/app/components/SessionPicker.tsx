import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { listSessionSummaries, type SessionInfo } from '../../session/store.js';

function relTime(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SessionPicker({
  cwd,
  onSelect,
  onCancel,
}: {
  cwd: string;
  onSelect: (id: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [sessions] = useState<SessionInfo[]>(() => listSessionSummaries(cwd));
  const [sel, setSel] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) setSel((s) => Math.max(0, s - 1));
    else if (key.downArrow) setSel((s) => Math.min(Math.max(0, sessions.length - 1), s + 1));
    else if (key.return) {
      const s = sessions[sel];
      if (s) onSelect(s.id);
    } else if (key.escape) onCancel();
  });

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text>No previous sessions for this project.</Text>
        <Text color="gray">esc to close</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        Resume a session
      </Text>
      {sessions.map((s, i) => (
        <Text key={s.id} color={i === sel ? 'cyan' : undefined}>
          {i === sel ? '❯ ' : '  '}
          {relTime(s.mtimeMs).padEnd(8)} <Text color="gray">{s.messageCount} msgs</Text>{' '}
          {s.firstMessage || '(no messages)'}
        </Text>
      ))}
      <Text color="gray">↑↓ select · enter resume · esc cancel</Text>
    </Box>
  );
}
