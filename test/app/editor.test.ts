import { describe, it, expect } from 'vitest';
import * as ed from '../../src/app/editor.js';

describe('editor', () => {
  it('inserts at the cursor', () => {
    expect(ed.insert({ value: 'helloworld', cursor: 5 }, ' ')).toEqual({ value: 'hello world', cursor: 6 });
  });

  it('backspaces and forward-deletes at the cursor', () => {
    expect(ed.backspace({ value: 'abc', cursor: 2 })).toEqual({ value: 'ac', cursor: 1 });
    expect(ed.backspace({ value: 'abc', cursor: 0 })).toEqual({ value: 'abc', cursor: 0 });
    expect(ed.del({ value: 'abc', cursor: 1 })).toEqual({ value: 'ac', cursor: 1 });
    expect(ed.del({ value: 'abc', cursor: 3 })).toEqual({ value: 'abc', cursor: 3 });
  });

  it('moves by char and to home/end', () => {
    expect(ed.left({ value: 'abc', cursor: 2 }).cursor).toBe(1);
    expect(ed.left({ value: 'abc', cursor: 0 }).cursor).toBe(0);
    expect(ed.right({ value: 'abc', cursor: 3 }).cursor).toBe(3);
    expect(ed.home({ value: 'abc', cursor: 2 }).cursor).toBe(0);
    expect(ed.end({ value: 'abc', cursor: 0 }).cursor).toBe(3);
  });

  it('moves by word', () => {
    const s = ed.fromValue('foo bar baz');
    expect(ed.wordLeft(s).cursor).toBe(8);
    expect(ed.wordLeft(ed.wordLeft(s)).cursor).toBe(4);
    expect(ed.wordRight({ value: 'foo bar', cursor: 0 }).cursor).toBe(3);
  });

  it('deletes the previous word, kills to end, and clears', () => {
    expect(ed.deleteWordLeft({ value: 'foo bar', cursor: 7 })).toEqual({ value: 'foo ', cursor: 4 });
    expect(ed.killToEnd({ value: 'foobar', cursor: 3 })).toEqual({ value: 'foo', cursor: 3 });
    expect(ed.clearLine()).toEqual({ value: '', cursor: 0 });
  });
});
