import { describe, it, expect } from 'vitest';
import {
  fmtTokens,
  fmtElapsed,
  relTime,
  tildePath,
  firstLines,
  toolSummaryLines,
} from '../../src/app/format.js';

describe('format helpers', () => {
  it('fmtTokens abbreviates thousands', () => {
    expect(fmtTokens(950)).toBe('950');
    expect(fmtTokens(2300)).toBe('2.3k');
  });

  it('fmtElapsed shows seconds then minutes+seconds', () => {
    expect(fmtElapsed(45)).toBe('45s');
    expect(fmtElapsed(75)).toBe('1m 15s');
    expect(fmtElapsed(255)).toBe('4m 15s');
  });

  it('relTime renders coarse buckets', () => {
    const now = 1_000_000_000_000;
    expect(relTime(now - 5_000, now)).toBe('5s ago');
    expect(relTime(now - 120_000, now)).toBe('2m ago');
    expect(relTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(relTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });

  it('tildePath collapses the home prefix', () => {
    expect(tildePath('/home/u/p', '/home/u')).toBe('~/p');
    expect(tildePath('/elsewhere', '/home/u')).toBe('/elsewhere');
  });

  it('firstLines truncates with an ellipsis', () => {
    expect(firstLines('a\nb\nc', 2)).toBe('a\nb …');
    expect(firstLines('a\nb', 5)).toBe('a\nb');
  });

  it('toolSummaryLines prefers a differing title, else the output', () => {
    expect(toolSummaryLines({ output: 'x', title: 'Read foo (40 lines)' }, 'Read foo')).toEqual([
      'Read foo (40 lines)',
    ]);
    expect(toolSummaryLines({ output: 'line1\nline2' }, 'Bash echo')).toEqual(['line1', 'line2']);
    expect(toolSummaryLines({ output: '' }, 'Bash x')).toEqual(['(done)']);
  });
});
