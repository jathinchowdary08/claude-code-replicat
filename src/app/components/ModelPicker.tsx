import React from 'react';
import { MODELS } from '../../llm/models.js';
import { SelectList } from './SelectList.js';

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
  return (
    <SelectList
      title="Select a model"
      current={current}
      items={LIST.map((m) => ({
        value: m.id,
        label: `${m.label}${m.id === current ? ' (current)' : ''}`,
        hint: m.id,
      }))}
      onChoose={(id) => onSelect(id)}
      onCancel={onCancel}
      footer="↑↓ select · enter confirm · esc cancel"
    />
  );
}
