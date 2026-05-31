import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeCtx, makeTmpDir } from '../helpers.js';
import { readTool } from '../../src/tools/read.js';
import { writeTool } from '../../src/tools/write.js';
import { editTool } from '../../src/tools/edit.js';

const signal = new AbortController().signal;

describe('Read/Write/Edit', () => {
  it('writes a new file and reads it back with line numbers', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);

    const w = await writeTool.run({ file_path: 'a.txt', content: 'hello\nworld' }, ctx, signal);
    expect(w.isError).toBeFalsy();
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('hello\nworld');

    const r = await readTool.run({ file_path: 'a.txt' }, ctx, signal);
    expect(r.output).toContain('1\thello');
    expect(r.output).toContain('2\tworld');
  });

  it('refuses to overwrite a file that was not Read first', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    writeFileSync(join(dir, 'b.txt'), 'original');

    const w = await writeTool.run({ file_path: 'b.txt', content: 'new' }, ctx, signal);
    expect(w.isError).toBe(true);
    expect(w.output).toMatch(/has not been Read/);
  });

  it('edits an exact unique string and fails on ambiguity', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    await writeTool.run({ file_path: 'c.txt', content: 'foo bar foo' }, ctx, signal);
    await readTool.run({ file_path: 'c.txt' }, ctx, signal);

    const ambiguous = await editTool.run({ file_path: 'c.txt', old_string: 'foo', new_string: 'baz', replace_all: false }, ctx, signal);
    expect(ambiguous.isError).toBe(true);
    expect(ambiguous.output).toMatch(/not unique/);

    const all = await editTool.run(
      { file_path: 'c.txt', old_string: 'foo', new_string: 'baz', replace_all: true },
      ctx,
      signal,
    );
    expect(all.isError).toBeFalsy();
    expect(readFileSync(join(dir, 'c.txt'), 'utf8')).toBe('baz bar baz');
  });

  it('errors when old_string is absent', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    await writeTool.run({ file_path: 'd.txt', content: 'abc' }, ctx, signal);
    await readTool.run({ file_path: 'd.txt' }, ctx, signal);
    const res = await editTool.run({ file_path: 'd.txt', old_string: 'xyz', new_string: 'q', replace_all: false }, ctx, signal);
    expect(res.isError).toBe(true);
  });

  it('rejects path traversal outside the sandbox', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    await expect(readTool.run({ file_path: '../../etc/passwd' }, ctx, signal)).rejects.toThrow();
  });
});
