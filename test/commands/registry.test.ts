import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSlashCommand, isSlashCommand } from '../../src/commands/parse.js';
import { parseCommandFile, applyArguments } from '../../src/commands/custom.js';
import { buildCommandRegistry } from '../../src/commands/registry.js';
import type { CommandContext } from '../../src/commands/types.js';

const ctx: CommandContext = { cwd: process.cwd(), model: 'claude-sonnet-4-6', mode: 'default' };

describe('parseSlashCommand', () => {
  it('parses a command and its arguments', () => {
    expect(parseSlashCommand('/model claude-opus-4-8')).toEqual({
      name: 'model',
      args: 'claude-opus-4-8',
    });
    expect(parseSlashCommand('  /help')).toEqual({ name: 'help', args: '' });
  });

  it('returns null for non-commands and a lone slash', () => {
    expect(parseSlashCommand('hello world')).toBeNull();
    expect(parseSlashCommand('/')).toBeNull();
    expect(isSlashCommand('/x')).toBe(true);
    expect(isSlashCommand('x')).toBe(false);
  });
});

describe('custom command parsing', () => {
  it('reads frontmatter description and body', () => {
    const parsed = parseCommandFile('---\ndescription: Do a thing\n---\nThe body $ARGUMENTS here');
    expect(parsed.description).toBe('Do a thing');
    expect(parsed.body).toBe('The body $ARGUMENTS here');
  });

  it('substitutes or appends arguments', () => {
    expect(applyArguments('Run $ARGUMENTS now', 'tests')).toBe('Run tests now');
    expect(applyArguments('No placeholder', 'extra')).toBe('No placeholder\n\nextra');
  });
});

describe('buildCommandRegistry', () => {
  let home: string;
  let cwd: string;
  let prevHome: string | undefined;
  let prevUser: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'acode-home-'));
    cwd = mkdtempSync(join(tmpdir(), 'acode-proj-'));
    prevHome = process.env.HOME;
    prevUser = process.env.USERPROFILE;
    process.env.HOME = home;
    process.env.USERPROFILE = home;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUser === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUser;
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  it('resolves built-ins, aliases, and unknown commands', async () => {
    const reg = buildCommandRegistry(cwd);
    expect(reg.get('help')).toBeDefined();
    expect(reg.get('/mode')?.name).toBe('permission-mode');

    const clear = await reg.run('/clear', ctx);
    expect(clear).toEqual({ kind: 'clear' });

    const unknown = await reg.run('/nope', ctx);
    expect(unknown?.kind).toBe('message');
    expect((unknown as { text: string }).text).toMatch(/Unknown command/);

    expect(await reg.run('not a command', ctx)).toBeNull();
  });

  it('validates permission-mode arguments', async () => {
    const reg = buildCommandRegistry(cwd);
    expect(await reg.run('/permission-mode plan', ctx)).toEqual({ kind: 'set-mode', mode: 'plan' });
    const bad = await reg.run('/mode bogus', ctx);
    expect(bad?.kind).toBe('message');
  });

  it('suggests completions by prefix', () => {
    const reg = buildCommandRegistry(cwd);
    const names = reg.suggest('m').map((c) => c.name);
    expect(names).toContain('model');
    expect(names).toContain('permission-mode'); // matched via its /mode alias
  });

  it('loads file-backed custom commands that expand to a prompt', async () => {
    const dir = join(cwd, '.agent', 'commands');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'review.md'), '---\ndescription: Review code\n---\nReview $ARGUMENTS carefully');

    const reg = buildCommandRegistry(cwd);
    const review = reg.get('review');
    expect(review?.source).toBe('custom');
    expect(review?.description).toBe('Review code');

    const result = await reg.run('/review src/index.ts', ctx);
    expect(result).toEqual({ kind: 'prompt', text: 'Review src/index.ts carefully' });
  });
});
