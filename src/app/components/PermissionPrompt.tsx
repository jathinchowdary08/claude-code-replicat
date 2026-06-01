import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { PendingPrompt } from '../hooks/useAgentLoop.js';
import type { PermissionResolution } from '../../agent/events.js';
import { Markdown } from './Markdown.js';

interface Choice {
  label: string;
  resolve: () => void;
}

export function PermissionPrompt({ pending }: { pending: PendingPrompt }): React.ReactElement {
  const choices: Choice[] =
    pending.kind === 'permission'
      ? [
          { label: 'Yes', resolve: () => pending.onAnswer({ behavior: 'allow' } as PermissionResolution) },
          {
            label: `Yes, and don't ask again this session${pending.toolName ? ` for ${pending.toolName}` : ''}`,
            resolve: () =>
              pending.onAnswer({ behavior: 'allow', always: true, scope: 'tool' } as PermissionResolution),
          },
          {
            label: 'No, and tell Claude what to do differently',
            resolve: () => pending.onAnswer({ behavior: 'deny' } as PermissionResolution),
          },
        ]
      : [
          { label: 'Yes, proceed', resolve: () => pending.onAnswer(true) },
          { label: 'No, keep planning', resolve: () => pending.onAnswer(false) },
        ];

  const [sel, setSel] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) setSel((s) => Math.max(0, s - 1));
    else if (key.downArrow) setSel((s) => Math.min(choices.length - 1, s + 1));
    else if (key.return) choices[sel]!.resolve();
    else if (key.escape) choices[choices.length - 1]!.resolve();
    else if (input.length === 1 && input >= '1' && input <= String(choices.length)) {
      choices[Number(input) - 1]!.resolve();
    }
  });

  const planBody =
    pending.kind === 'plan' && pending.body
      ? pending.body.split('\n').slice(0, 24).join('\n') +
        (pending.body.split('\n').length > 24 ? '\n…' : '')
      : '';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">
        {pending.title}
      </Text>
      {planBody ? (
        <Box marginTop={1} flexDirection="column">
          <Markdown text={planBody} />
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        {choices.map((c, i) => (
          <Text key={i} color={i === sel ? 'cyan' : undefined}>
            {i === sel ? '❯ ' : '  '}
            {i + 1}. {c.label}
          </Text>
        ))}
      </Box>
      <Text color="gray">
        ↑↓ select · enter confirm · esc to {pending.kind === 'permission' ? 'deny' : 'keep planning'}
      </Text>
    </Box>
  );
}
