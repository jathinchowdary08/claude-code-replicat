import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../src/app/components/StatusBar.js';
import { emptyUsage } from '../../src/llm/tokens.js';

describe('StatusBar', () => {
  it('shows model, mode, context-left and cost', () => {
    const { lastFrame } = render(
      <StatusBar
        model="claude-sonnet-4-6"
        cwd="/tmp/project"
        mode="default"
        usage={emptyUsage()}
        cost={0}
        contextTokens={0}
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('Sonnet 4.6');
    expect(out).toContain('project');
    expect(out).toContain('100% context');
    expect(out).toContain('$0.0000');
  });
});
