/**
 * Reconstruct UI history items from a saved Anthropic message transcript, so a
 * resumed session shows the original turns (text, tool calls + their results,
 * and thinking) rather than just plain text. Pure / unit-testable.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { HistoryItem } from './hooks/useAgentLoop.js';

interface Block {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const cc = c as { type?: string; text?: string };
        return cc.type === 'text' ? (cc.text ?? '') : `[${cc.type ?? 'block'}]`;
      })
      .join('\n');
  }
  return '';
}

export function reconstructItems(messages: Anthropic.MessageParam[]): HistoryItem[] {
  const items: HistoryItem[] = [];
  const toolIndex = new Map<string, number>();

  for (const m of messages) {
    const content = m.content;
    if (typeof content === 'string') {
      items.push(
        m.role === 'user'
          ? { kind: 'user', text: content }
          : { kind: 'assistant', text: content, streaming: false },
      );
      continue;
    }
    for (const raw of content) {
      const b = raw as Block;
      if (b.type === 'text' && b.text) {
        items.push(
          m.role === 'user'
            ? { kind: 'user', text: b.text }
            : { kind: 'assistant', text: b.text, streaming: false },
        );
      } else if (b.type === 'thinking' && b.thinking) {
        items.push({ kind: 'thinking', text: b.thinking, streaming: false });
      } else if (b.type === 'tool_use') {
        const id = b.id ?? '';
        const name = b.name ?? 'tool';
        toolIndex.set(id, items.length);
        items.push({ kind: 'tool', id, name, title: name, status: 'done' });
      } else if (b.type === 'tool_result') {
        const idx = b.tool_use_id !== undefined ? toolIndex.get(b.tool_use_id) : undefined;
        if (idx !== undefined) {
          const it = items[idx];
          if (it && it.kind === 'tool') {
            items[idx] = {
              ...it,
              status: b.is_error ? 'denied' : 'done',
              result: { output: toolResultText(b.content), isError: b.is_error },
            };
          }
        }
      }
    }
  }
  return items;
}
