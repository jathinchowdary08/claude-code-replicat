import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { reconstructItems } from '../../src/app/transcript.js';

describe('reconstructItems', () => {
  it('rebuilds text, thinking, and tool_use + tool_result into items', () => {
    const messages = [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'pondering' },
          { type: 'text', text: 'Reading the file.' },
          { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.txt' } },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'file contents' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] },
    ] as unknown as Anthropic.MessageParam[];

    const items = reconstructItems(messages);
    expect(items[0]).toEqual({ kind: 'user', text: 'hi' });
    expect(items[1]).toEqual({ kind: 'thinking', text: 'pondering', streaming: false });
    expect(items[2]).toEqual({ kind: 'assistant', text: 'Reading the file.', streaming: false });

    const tool = items[3];
    expect(tool?.kind).toBe('tool');
    if (tool?.kind === 'tool') {
      expect(tool.status).toBe('done');
      expect(tool.result?.output).toBe('file contents');
    }
    expect(items[4]).toEqual({ kind: 'assistant', text: 'Done.', streaming: false });
  });
});
