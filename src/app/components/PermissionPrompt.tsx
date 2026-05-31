import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { PendingPrompt } from '../hooks/useAgentLoop.js';
import { Markdown } from './Markdown.js';

export function PermissionPrompt({ pending }: { pending: PendingPrompt }): React.ReactElement {
  useInput((input, key) => {
    const k = input.toLowerCase();
    if (pending.kind === 'permission') {
      if (k === 'y') pending.onAnswer({ behavior: 'allow' });
      else if (k === 'a') pending.onAnswer({ behavior: 'allow', always: true, scope: 'tool' });
      else if (k === 'n' || key.escape) pending.onAnswer({ behavior: 'deny' });
    } else {
      if (k === 'y') pending.onAnswer(true);
      else if (k === 'n' || key.escape) pending.onAnswer(false);
    }
  });

  const planBody = pending.body
    ? pending.body.split('\n').slice(0, 24).join('\n') + (pending.body.split('\n').length > 24 ? '\n…' : '')
    : '';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">
        {pending.title}
      </Text>
      {pending.kind === 'plan' && planBody ? (
        <Box marginTop={1} flexDirection="column">
          <Markdown text={planBody} />
        </Box>
      ) : null}
      <Box marginTop={1}>
        {pending.kind === 'permission' ? (
          <Text>
            <Text color="green">y</Text> allow once · <Text color="cyan">a</Text> always allow{' '}
            {pending.toolName ? `${pending.toolName} ` : ''}· <Text color="red">n</Text> deny
          </Text>
        ) : (
          <Text>
            <Text color="green">y</Text> approve & implement · <Text color="red">n</Text> keep planning
          </Text>
        )}
      </Box>
    </Box>
  );
}
