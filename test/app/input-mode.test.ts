import { describe, it, expect } from 'vitest';
import { classifyInput } from '../../src/app/input-mode.js';

describe('classifyInput', () => {
  it('classifies each input prefix', () => {
    expect(classifyInput('')).toEqual({ kind: 'empty' });
    expect(classifyInput('   ')).toEqual({ kind: 'empty' });
    expect(classifyInput('/help')).toEqual({ kind: 'command', text: '/help' });
    expect(classifyInput('!ls -la')).toEqual({ kind: 'bash', command: 'ls -la' });
    expect(classifyInput('#remember this')).toEqual({ kind: 'memory', note: 'remember this' });
    expect(classifyInput('# remember this')).toEqual({ kind: 'memory', note: 'remember this' });
    expect(classifyInput('hello there')).toEqual({ kind: 'prompt', text: 'hello there' });
  });
});
