import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addPermissionRule } from '../../src/config/settings-write.js';

describe('addPermissionRule', () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'settings-'));
    file = join(dir, '.agent', 'settings.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('creates the file and adds an allow rule', () => {
    const list = addPermissionRule(file, 'allow', 'Bash(npm run build)');
    expect(list).toEqual(['Bash(npm run build)']);
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved.permissions.allow).toEqual(['Bash(npm run build)']);
  });

  it('is idempotent and preserves existing rules', () => {
    addPermissionRule(file, 'allow', 'Read');
    addPermissionRule(file, 'allow', 'Read');
    const list = addPermissionRule(file, 'allow', 'Edit');
    expect(list).toEqual(['Read', 'Edit']);
  });

  it('merges into an existing settings file without clobbering other keys', () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ model: 'opus', permissions: { allow: ['Read'], deny: [] } }), 'utf8');
    const list = addPermissionRule(file, 'deny', 'Bash(rm:*)');
    expect(list).toEqual(['Bash(rm:*)']);
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved.model).toBe('opus');
    expect(saved.permissions.allow).toEqual(['Read']);
    expect(saved.permissions.deny).toEqual(['Bash(rm:*)']);
  });
});
