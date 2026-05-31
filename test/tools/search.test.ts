import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeCtx, makeTmpDir } from '../helpers.js';
import { globTool } from '../../src/tools/glob.js';
import { grepTool } from '../../src/tools/grep.js';
import { lsTool } from '../../src/tools/ls.js';

const signal = new AbortController().signal;

function seed(dir: string) {
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1; // TODO: refine');
  writeFileSync(join(dir, 'src', 'b.ts'), 'export const b = 2;');
  writeFileSync(join(dir, 'readme.md'), '# hello');
}

describe('Glob/Grep/LS', () => {
  it('globs files by pattern', async () => {
    const dir = makeTmpDir();
    seed(dir);
    const ctx = makeCtx(dir);
    const res = await globTool.run({ pattern: '**/*.ts' }, ctx, signal);
    expect(res.output).toContain('a.ts');
    expect(res.output).toContain('b.ts');
    expect(res.output).not.toContain('readme.md');
  });

  it('greps file contents (files_with_matches and content modes)', async () => {
    const dir = makeTmpDir();
    seed(dir);
    const ctx = makeCtx(dir);

    const files = await grepTool.run({ pattern: 'TODO', output_mode: 'files_with_matches' }, ctx, signal);
    expect(files.output).toContain('a.ts');
    expect(files.output).not.toContain('b.ts');

    const content = await grepTool.run({ pattern: 'export const', output_mode: 'content', '-n': true }, ctx, signal);
    expect(content.output).toMatch(/a\.ts:1:/);
  });

  it('lists a directory with dirs marked', async () => {
    const dir = makeTmpDir();
    seed(dir);
    const ctx = makeCtx(dir);
    const res = await lsTool.run({ path: '.' }, ctx, signal);
    expect(res.output).toContain('src/');
    expect(res.output).toContain('readme.md');
  });
});
