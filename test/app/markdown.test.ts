import { describe, it, expect } from 'vitest';
import { parseInline, parseMarkdown } from '../../src/app/markdown.js';

describe('parseInline', () => {
  it('splits bold, italic and code spans', () => {
    expect(parseInline('a **b** c')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }]);
    expect(parseInline('use `x` now')).toEqual([{ text: 'use ' }, { text: 'x', code: true }, { text: ' now' }]);
    expect(parseInline('_em_')).toEqual([{ text: 'em', italic: true }]);
    expect(parseInline('plain')).toEqual([{ text: 'plain' }]);
  });
});

describe('parseMarkdown', () => {
  it('parses headings, lists, quotes, fenced code and rules', () => {
    const md = ['# Title', '', '- one', '- two', '', '1. first', '', '> quote', '', '```ts', 'code line', '```', '', '---', 'a para'].join('\n');
    const blocks = parseMarkdown(md);
    const types = blocks.map((b) => b.type);
    expect(types).toContain('heading');
    expect(types).toContain('bullet');
    expect(types).toContain('ordered');
    expect(types).toContain('quote');
    expect(types).toContain('code');
    expect(types).toContain('rule');
    expect(types).toContain('paragraph');

    const code = blocks.find((b) => b.type === 'code');
    expect(code?.type === 'code' && code.lang).toBe('ts');
    expect(code?.type === 'code' && code.lines).toEqual(['code line']);

    const heading = blocks.find((b) => b.type === 'heading');
    expect(heading?.type === 'heading' && heading.level).toBe(1);
  });
});
