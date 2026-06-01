import React, { useEffect, useRef, useState } from 'react';
import { Box, Static, Text, useApp, useInput } from 'ink';
import type { Runtime } from '../runtime.js';
import type { CliArgs } from '../cli/args.js';
import { useAgentLoop } from './hooks/useAgentLoop.js';
import { listProjectFiles } from './files.js';
import { MessageItem } from './components/MessageList.js';
import { Banner } from './components/Banner.js';
import { TodoView } from './components/TodoView.js';
import { Thinking } from './components/Thinking.js';
import { StatusBar } from './components/StatusBar.js';
import { InputBox } from './components/InputBox.js';
import { ModelPicker } from './components/ModelPicker.js';
import { SessionPicker } from './components/SessionPicker.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';

const VERSION = '0.1.0';

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

  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => {
    setFiles(listProjectFiles(rt.ctx.cwd));
  }, [rt.ctx.cwd]);

  // Finished turns are committed into <Static> so the scrollback prints once.
  const [committed, setCommitted] = useState(0);
  const [gen, setGen] = useState(0);
  const prevCommitted = useRef(0);
  useEffect(() => {
    if (loop.status === 'idle') setCommitted(loop.items.length);
  }, [loop.status, loop.items.length]);
  useEffect(() => {
    if (committed < prevCommitted.current) setGen((g) => g + 1);
    prevCommitted.current = committed;
  }, [committed]);

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
    if (key.tab && key.shift) {
      loop.cycleMode();
      return;
    }
    if (key.escape && loop.status === 'running' && !loop.pending) loop.cancel();
  });

  const staticEntries: Array<{ key: string; node: React.ReactNode }> = [
    { key: 'banner', node: <Banner model={loop.model} cwd={rt.ctx.cwd} version={VERSION} /> },
    ...loop.items.slice(0, committed).map((it, i) => ({ key: `m${i}`, node: <MessageItem item={it} /> })),
  ];
  const liveItems = loop.items.slice(committed);
  const showTodos =
    loop.todos.length > 0 && (loop.status === 'running' || loop.todos.some((t) => t.status !== 'completed'));

  return (
    <Box flexDirection="column">
      <Static key={gen} items={staticEntries}>
        {(entry) => (
          <Box key={entry.key} flexDirection="column" marginBottom={entry.key === 'banner' ? 1 : 0}>
            {entry.node}
          </Box>
        )}
      </Static>

      {liveItems.map((it, i) => (
        <MessageItem key={`live-${committed + i}`} item={it} />
      ))}

      {/* Spinner first, todos beneath it (like Claude Code). */}
      {loop.status === 'running' && !loop.pending && (
        <Box marginTop={1}>
          <Thinking usage={loop.usage} cost={loop.cost} />
        </Box>
      )}

      {showTodos && <TodoView todos={loop.todos} />}

      {loop.pending ? (
        <Box marginTop={1}>
          <PermissionPrompt pending={loop.pending} />
        </Box>
      ) : loop.sessionPicker ? (
        <Box marginTop={1}>
          <SessionPicker cwd={rt.ctx.cwd} onSelect={loop.resumeSession} onCancel={loop.closeSessionPicker} />
        </Box>
      ) : loop.modelPicker ? (
        <Box marginTop={1}>
          <ModelPicker current={loop.model} onSelect={loop.chooseModel} onCancel={loop.closeModelPicker} />
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {loop.mode !== 'default' && (
            <Text color={loop.mode === 'plan' ? 'yellow' : 'green'}>
              {loop.mode === 'plan' ? '⏵⏵ plan mode on' : '⏵⏵ accept edits on'}
              <Text color="gray"> (shift+tab to cycle)</Text>
            </Text>
          )}
          <InputBox
            onSubmit={loop.send}
            disabled={loop.status === 'running'}
            suggestCommands={loop.suggestCommands}
            files={files}
          />
        </Box>
      )}

      <StatusBar model={loop.model} cwd={rt.ctx.cwd} mode={loop.mode} usage={loop.usage} cost={loop.cost} />
    </Box>
  );
}
