import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { SelectList } from '../../src/app/components/SelectList.js';

describe('SelectList', () => {
  it('renders the title, items, hints and a footer', () => {
    const { lastFrame } = render(
      <SelectList
        title="Pick one"
        items={[
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana', hint: 'yellow' },
        ]}
        onChoose={() => {}}
        footer="enter to pick"
      />,
    );
    const out = lastFrame() ?? '';
    expect(out).toContain('Pick one');
    expect(out).toContain('Apple');
    expect(out).toContain('Banana');
    expect(out).toContain('yellow');
    expect(out).toContain('enter to pick');
  });

  it('shows a placeholder when there are no items', () => {
    const { lastFrame } = render(<SelectList title="Empty" items={[]} onChoose={() => {}} />);
    expect(lastFrame() ?? '').toContain('(nothing here)');
  });
});
