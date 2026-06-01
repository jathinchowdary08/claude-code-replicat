import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore, openSession } from '../../src/session/store.js';

// A virtual project path — only its hash matters; it need not exist on disk.
const cwd = join(tmpdir(), 'virtual-acode-project');

describe('SessionStore', () => {
  let home: string;
  let prevHome: string | undefined;
  let prevUser: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'acode-home-'));
    prevHome = process.env.HOME;
    prevUser = process.env.USERPROFILE;
    // os.homedir() honors HOME (POSIX) / USERPROFILE (Windows); redirect both.
    process.env.HOME = home;
    process.env.USERPROFILE = home;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUser === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUser;
    rmSync(home, { recursive: true, force: true });
  });

  it('creates a transcript and reconstructs messages on load', () => {
    const store = SessionStore.create(cwd, 'claude-sonnet-4-6');
    store.appendMessage({ role: 'user', content: 'hello' });
    store.appendMessage({ role: 'assistant', content: [{ type: 'text', text: 'hi there' }] });

    const loaded = SessionStore.load(cwd, store.id);
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[0]).toEqual({ role: 'user', content: 'hello' });
    expect(loaded.meta?.model).toBe('claude-sonnet-4-6');
    expect(loaded.meta?.version).toBe(1);
  });

  it('redacts secrets before writing to disk', () => {
    const store = SessionStore.create(cwd);
    store.appendMessage({
      role: 'user',
      content: 'my key is sk-ant-ABCDEFGHIJKLMNOP1234567890',
    });
    const raw = readFileSync(store.path, 'utf8');
    expect(raw).not.toContain('sk-ant-ABCDEFGHIJKLMNOP');
    expect(raw).toContain('sk-ant-[REDACTED]');
  });

  it('lists transcripts newest-first and reports the latest id', () => {
    const s1 = SessionStore.create(cwd);
    const s2 = SessionStore.create(cwd);
    // Force deterministic mtimes so ordering does not depend on FS resolution.
    utimesSync(s1.path, new Date(1_000_000), new Date(1_000_000));
    utimesSync(s2.path, new Date(2_000_000), new Date(2_000_000));

    const ids = SessionStore.list(cwd).map((s) => s.id);
    expect(ids).toEqual([s2.id, s1.id]);
    expect(SessionStore.latestId(cwd)).toBe(s2.id);
  });

  it('resumes a specific session and appends to the same file', () => {
    const a = SessionStore.create(cwd);
    a.appendMessage({ role: 'user', content: 'first' });

    const opened = openSession(cwd, { resume: a.id });
    expect(opened.resumed).toBe(true);
    expect(opened.store.id).toBe(a.id);
    expect(opened.messages).toHaveLength(1);

    opened.store.appendMessage({ role: 'assistant', content: [{ type: 'text', text: 'reply' }] });
    expect(SessionStore.load(cwd, a.id).messages).toHaveLength(2);
  });

  it('continues the latest session', () => {
    const a = SessionStore.create(cwd);
    a.appendMessage({ role: 'user', content: 'old' });
    const b = SessionStore.create(cwd);
    b.appendMessage({ role: 'user', content: 'new' });
    utimesSync(a.path, new Date(1_000_000), new Date(1_000_000));
    utimesSync(b.path, new Date(2_000_000), new Date(2_000_000));

    const opened = openSession(cwd, { continueLatest: true });
    expect(opened.store.id).toBe(b.id);
    expect(opened.messages[0]).toEqual({ role: 'user', content: 'new' });
  });

  it('creates a fresh session when neither resume nor continue is set', () => {
    const opened = openSession(cwd, {});
    expect(opened.resumed).toBe(false);
    expect(opened.messages).toHaveLength(0);
  });

  it('throws when resuming an unknown id', () => {
    expect(() => openSession(cwd, { resume: 'does-not-exist' })).toThrow();
  });

  it('throws when continuing with no prior sessions', () => {
    expect(() => openSession(cwd, { continueLatest: true })).toThrow();
  });
});
