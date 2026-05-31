import React, { useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { Runtime } from '../runtime.js';
import type { CliArgs } from '../cli/args.js';
import { useAgentLoop } from './hooks/useAgentLoop.js';
import { MessageList } from './components/MessageList.js';
import { Spinner } from './components/Spinner.js';
import { StatusBar } from './components/StatusBar.js';
import { InputBox } from './components/InputBox.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';

export function App({
  rt,
  initialPrompt,
}: {
  rt: Runtime;
  args: CliArgs;
  initialPrompt?: string;
}): React.ReactElement {
  const { exit } = useApp();
  const loop = useAgentLoop(rt);
  const ctrlC = useRef(0);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (!sentInitial.current && initialPrompt) {
      sentInitial.current = true;
      loop.send(initialPrompt);
    }
  }, [initialPrompt, loop]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      const now = Date.now();
      if (now - ctrlC.current < 1000) {
        exit();
        return;
      }
      ctrlC.current = now;
      if (loop.status === 'running') loop.cancel();
      return;
    }
    if (key.escape && loop.status === 'running' && !loop.pending) loop.cancel();
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Agent Code
        </Text>
        <Text color="gray"> — type a message · ctrl-c twice to exit · esc to interrupt</Text>
      </Box>

      <MessageList items={loop.items} />

      {loop.status === 'running' && !loop.pending && (
        <Box marginTop={1}>
          <Spinner label="thinking…" />
        </Box>
      )}

      {loop.pending ? (
        <Box marginTop={1}>
          <PermissionPrompt pending={loop.pending} />
        </Box>
      ) : (
        <Box marginTop={1}>
          <InputBox onSubmit={loop.send} disabled={loop.status === 'running'} />
        </Box>
      )}

      <StatusBar model={rt.model} cwd={rt.ctx.cwd} mode={rt.permissions.mode} usage={loop.usage} cost={loop.cost} />
    </Box>
  );
}
