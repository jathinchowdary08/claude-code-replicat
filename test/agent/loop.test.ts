import { describe, it, expect } from 'vitest';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runAgent } from '../../src/agent/loop.js';
import { buildRegistry } from '../../src/tools/registry.js';
import { coreTools } from '../../src/tools/index.js';
import { PermissionEngine } from '../../src/permissions/engine.js';
import { HookRunner } from '../../src/hooks/runner.js';
import type { AgentEvent } from '../../src/agent/events.js';
import { assistantMessage, fakeClient, fakeStream, makeCtx, makeTmpDir, textDelta } from '../helpers.js';

const signal = () => new AbortController().signal;

describe('runAgent', () => {
  it('drives the tool_use → tool_result → end_turn cycle', async () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, 'a.txt'), 'file contents here');
    const ctx = makeCtx(dir);

    const client = fakeClient([
      fakeStream(
        [textDelta('Reading the file.')],
        assistantMessage(
          [
            { type: 'text', text: 'Reading the file.' },
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.txt' } },
          ],
          'tool_use',
        ),
      ),
      fakeStream([textDelta('Done.')], assistantMessage([{ type: 'text', text: 'Done.' }], 'end_turn')),
    ]);

    const events: AgentEvent[] = [];
    for await (const ev of runAgent({
      client,
      model: 'claude-sonnet-4-6',
      system: 'sys',
      registry: buildRegistry(coreTools),
      messages: [{ role: 'user', content: 'read a.txt' }],
      signal: signal(),
      permissions: new PermissionEngine({ mode: 'default' }),
      hooks: new HookRunner({}, dir),
      ctx,
      confirmPermission: async () => ({ behavior: 'deny' }),
    })) {
      events.push(ev);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('tool_request');
    expect(types).toContain('tool_result');

    const toolResult = events.find((e) => e.type === 'tool_result');
    expect(toolResult && toolResult.type === 'tool_result' && toolResult.result.output).toContain('file contents here');

    const end = events.find((e) => e.type === 'turn_end');
    expect(end && end.type === 'turn_end' && end.stopReason).toBe('end_turn');

    const text = events
      .filter((e): e is Extract<AgentEvent, { type: 'assistant_text' }> => e.type === 'assistant_text')
      .map((e) => e.delta)
      .join('');
    expect(text).toContain('Done.');
  });

  it('denies a gated tool when the user refuses, and does not run it', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);

    const client = fakeClient([
      fakeStream(
        [],
        assistantMessage(
          [{ type: 'tool_use', id: 'w1', name: 'Write', input: { file_path: 'x.txt', content: 'hi' } }],
          'tool_use',
        ),
      ),
      fakeStream([textDelta('ok')], assistantMessage([{ type: 'text', text: 'ok' }], 'end_turn')),
    ]);

    const events: AgentEvent[] = [];
    for await (const ev of runAgent({
      client,
      model: 'claude-sonnet-4-6',
      system: 'sys',
      registry: buildRegistry(coreTools),
      messages: [{ role: 'user', content: 'write x' }],
      signal: signal(),
      permissions: new PermissionEngine({ mode: 'default' }),
      hooks: new HookRunner({}, dir),
      ctx,
      confirmPermission: async () => ({ behavior: 'deny', message: 'nope' }),
    })) {
      events.push(ev);
    }

    const denied = events.find((e) => e.type === 'tool_denied');
    expect(denied && denied.type === 'tool_denied' && denied.name).toBe('Write');
    expect(existsSync(join(dir, 'x.txt'))).toBe(false);
  });
});
