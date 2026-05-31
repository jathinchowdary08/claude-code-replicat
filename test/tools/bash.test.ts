import { describe, it, expect } from 'vitest';
import { makeCtx, makeTmpDir } from '../helpers.js';
import { bashTool } from '../../src/tools/bash.js';
import { bashOutputTool } from '../../src/tools/bashOutput.js';

const signal = new AbortController().signal;

describe('Bash', () => {
  it('runs a command and captures output', async () => {
    const ctx = makeCtx(makeTmpDir());
    const res = await bashTool.run({ command: 'echo hello', run_in_background: false }, ctx, signal);
    expect(res.output).toContain('hello');
    expect(res.isError).toBeFalsy();
  });

  it('reports a non-zero exit as an error', async () => {
    const ctx = makeCtx(makeTmpDir());
    const res = await bashTool.run({ command: 'exit 3', run_in_background: false }, ctx, signal);
    expect(res.isError).toBe(true);
    expect(res.output).toMatch(/exit code 3/);
  });

  it('refuses interactive commands', async () => {
    const ctx = makeCtx(makeTmpDir());
    const res = await bashTool.run({ command: 'vim file.txt', run_in_background: false }, ctx, signal);
    expect(res.isError).toBe(true);
    expect(res.output).toMatch(/interactive/i);
  });

  it('starts a background shell tracked by the manager', async () => {
    const ctx = makeCtx(makeTmpDir());
    const res = await bashTool.run({ command: 'echo bg', run_in_background: true }, ctx, signal);
    expect(res.output).toMatch(/Started background shell/);
    const id = /`(bash_[a-f0-9]+)`/.exec(res.output)?.[1];
    expect(id).toBeTruthy();
    const out = await bashOutputTool.run({ bash_id: id! }, ctx, signal);
    expect(out.isError).toBeFalsy();
    expect(out.output).toMatch(/status:/);
  });
});
