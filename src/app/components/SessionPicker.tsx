import React, { useState } from 'react';
import { listSessionSummaries, type SessionInfo } from '../../session/store.js';
import { relTime } from '../format.js';
import { SelectList } from './SelectList.js';

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

  return (
    <SelectList
      title="Resume a session"
      items={sessions.map((s) => ({
        value: s.id,
        label: `${relTime(s.mtimeMs).padEnd(8)} ${s.firstMessage || '(no messages)'}`,
        hint: `${s.messageCount} msgs`,
      }))}
      onChoose={(id) => onSelect(id)}
      onCancel={onCancel}
      footer="↑↓ select · enter resume · esc cancel"
    />
  );
}
