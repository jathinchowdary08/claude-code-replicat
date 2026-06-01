/**
 * A small, dependency-free Markdown parser for the terminal. Pure (no Ink), so it
 * can be unit-tested directly; the `Markdown` component renders the blocks it returns.
 */

export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type MdBlock =
  | { type: 'heading'; level: number; spans: InlineSpan[] }
  | { type: 'paragraph'; spans: InlineSpan[] }
  | { type: 'bullet'; indent: number; spans: InlineSpan[] }
  | { type: 'ordered'; indent: number; number: number; spans: InlineSpan[] }
  | { type: 'quote'; spans: InlineSpan[] }
  | { type: 'code'; lang?: string; lines: string[] }
  | { type: 'rule' }
  | { type: 'blank' };

const INLINE_RE = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|`([^`]+)`)/g;

/** Split a line into styled spans (bold/italic/code). */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    const bold = m[2] ?? m[3];
    const italic = m[4] ?? m[5];
    const code = m[6];
    if (bold !== undefined) spans.push({ text: bold, bold: true });
    else if (italic !== undefined) spans.push({ text: italic, italic: true });
    else if (code !== undefined) spans.push({ text: code, code: true });
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text }];
}

/** Parse markdown text into a flat list of renderable blocks. */
export function parseMarkdown(text: string): MdBlock[] {
  const out: MdBlock[] = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    const fence = line.match(/^\s*```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1];
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i]!)) {
        code.push(lines[i]!);
        i++;
      }
      i++; // skip closing fence
      out.push(lang ? { type: 'code', lang, lines: code } : { type: 'code', lines: code });
      continue;
    }

    if (line.trim() === '') {
      out.push({ type: 'blank' });
      i++;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push({ type: 'rule' });
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      out.push({ type: 'heading', level: heading[1]!.length, spans: parseInline(heading[2]!) });
      i++;
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      out.push({ type: 'quote', spans: parseInline(quote[1]!) });
      i++;
      continue;
    }
    const ordered = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (ordered) {
      out.push({
        type: 'ordered',
        indent: Math.floor(ordered[1]!.length / 2),
        number: Number(ordered[2]),
        spans: parseInline(ordered[3]!),
      });
      i++;
      continue;
    }
    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bullet) {
      out.push({ type: 'bullet', indent: Math.floor(bullet[1]!.length / 2), spans: parseInline(bullet[2]!) });
      i++;
      continue;
    }
    out.push({ type: 'paragraph', spans: parseInline(line) });
    i++;
  }
  return out;
}
