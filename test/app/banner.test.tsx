import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Banner } from '../../src/app/components/Banner.js';

describe('Banner', () => {
  it('renders the title, model, context window and tips', () => {
    const { lastFrame } = render(<Banner model="claude-sonnet-4-6" cwd="/tmp/project" version="0.1.0" />);
    const out = lastFrame() ?? '';
    expect(out).toContain('Agent Code');
    expect(out).toContain('v0.1.0');
    expect(out).toContain('Sonnet 4.6');
    expect(out).toContain('200K context');
    expect(out).toContain('Tips for getting started');
  });
});
