import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Markdown } from '../../src/app/components/Markdown.js';

describe('Markdown component', () => {
  it('renders headings, inline code and bullets', () => {
    const { lastFrame } = render(<Markdown text={'# Hello\n\nuse `code` here\n\n- item one'} />);
    const out = lastFrame() ?? '';
    expect(out).toContain('Hello');
    expect(out).toContain('code');
    expect(out).toContain('• item one');
  });

  it('renders fenced code with its language label', () => {
    const { lastFrame } = render(<Markdown text={'```ts\nconst x = 1;\n```'} />);
    const out = lastFrame() ?? '';
    expect(out).toContain('ts');
    expect(out).toContain('const x = 1;');
  });
});
