/** Context compaction: summarize older turns when nearing the context window. */
import type Anthropic from '@anthropic-ai/sdk';
import { logger } from '../util/logger.js';

/** Rough token estimate (~4 chars/token) over the message contents. */
export function estimateTokens(messages: Anthropic.MessageParam[]): number {
  let chars = 0;
  for (const m of messages) chars += renderContent(m.content).length;
  return Math.ceil(chars / 4);
}

function renderContent(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;
  const out: string[] = [];
  for (const block of content) {
    if (block.type === 'text') out.push(block.text);
    else if (block.type === 'tool_use') out.push(`[tool_use ${block.name} ${JSON.stringify(block.input)}]`);
    else if (block.type === 'tool_result') {
      const c = block.content;
      out.push(typeof c === 'string' ? c : JSON.stringify(c));
    } else out.push(`[${block.type}]`);
  }
  return out.join('\n');
}

/** Index of the most recent `user` message at/after the desired keep boundary. */
function userBoundary(messages: Anthropic.MessageParam[], keepApprox: number): number {
  for (let i = Math.max(0, messages.length - keepApprox); i < messages.length; i++) {
    if (messages[i]!.role === 'user') return i;
  }
  return -1;
}

async function summarize(
  client: Anthropic,
  model: string,
  head: Anthropic.MessageParam[],
): Promise<string | null> {
  const transcript = head
    .map((m) => `${m.role.toUpperCase()}: ${renderContent(m.content)}`)
    .join('\n\n')
    .slice(0, 100_000);
  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Summarize this coding-agent conversation so work can continue with full context. Capture: the user's goal, decisions made, files created/edited, commands run, and any open tasks. Be specific and concise.\n\n${transcript}`,
        },
      ],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return text.trim() || null;
  } catch (err) {
    logger.warn('compaction summarize failed:', err);
    return null;
  }
}

export interface CompactOptions {
  client: Anthropic;
  model: string;
  messages: Anthropic.MessageParam[];
  contextWindow: number;
  /** Fraction of the window that triggers compaction. */
  threshold?: number;
  /** Force compaction regardless of the threshold (manual /compact). */
  force?: boolean;
}

/** If near the context limit, replace older turns with a summary. Mutates `messages`. */
export async function maybeCompact(opts: CompactOptions): Promise<boolean> {
  const { client, model, messages, contextWindow } = opts;
  const threshold = opts.threshold ?? 0.8;
  if (!opts.force && estimateTokens(messages) < contextWindow * threshold) return false;
  if (messages.length <= 4) return false;

  const boundary = userBoundary(messages, 4);
  if (boundary <= 0) return false;

  const head = messages.slice(0, boundary);
  const tail = messages.slice(boundary);
  const summary = await summarize(client, model, head);
  if (!summary) return false;

  const rebuilt: Anthropic.MessageParam[] = [
    { role: 'user', content: `Summary of the earlier conversation:\n\n${summary}` },
    { role: 'assistant', content: 'Understood. I will continue with that context in mind.' },
    ...tail,
  ];
  messages.length = 0;
  messages.push(...rebuilt);
  logger.info(`compacted conversation: kept ${tail.length} recent messages`);
  return true;
}
