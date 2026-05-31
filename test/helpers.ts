import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PathSandbox } from '../src/util/fs.js';
import { ShellManager } from '../src/tools/shellManager.js';
import type { ToolContext } from '../src/tools/types.js';

export function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'agent-test-'));
}

export function makeCtx(cwd: string): ToolContext {
  return {
    cwd,
    sandbox: new PathSandbox([cwd]),
    readFiles: new Set(),
    todos: [],
    shells: new ShellManager(),
    planMode: false,
  };
}

/** Minimal fake of the Anthropic stream object the LLM layer consumes. */
export function fakeStream(events: unknown[], finalMessage: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
    },
    async finalMessage() {
      return finalMessage;
    },
  };
}

/** A fake Anthropic client that returns the given streams in sequence. */
export function fakeClient(streams: Array<ReturnType<typeof fakeStream>>): any {
  let i = 0;
  return {
    messages: {
      stream: () => streams[i++],
    },
  };
}

export function textDelta(text: string) {
  return { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
}

export function assistantMessage(content: unknown[], stopReason: string) {
  return {
    role: 'assistant',
    content,
    stop_reason: stopReason,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}
