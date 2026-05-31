import { describe, it, expect } from 'vitest';
import { PermissionEngine } from '../../src/permissions/engine.js';
import { readTool } from '../../src/tools/read.js';
import { writeTool } from '../../src/tools/write.js';
import { bashTool } from '../../src/tools/bash.js';

describe('PermissionEngine', () => {
  it('auto-allows read-only tools in default mode', () => {
    const e = new PermissionEngine({ mode: 'default' });
    expect(e.decide(readTool, { file_path: 'x' }).decision).toBe('allow');
  });

  it('asks before mutating tools in default mode', () => {
    const e = new PermissionEngine({ mode: 'default' });
    expect(e.decide(writeTool, { file_path: 'x', content: '' }).decision).toBe('ask');
  });

  it('auto-allows edits in acceptEdits mode but still asks for Bash', () => {
    const e = new PermissionEngine({ mode: 'acceptEdits' });
    expect(e.decide(writeTool, { file_path: 'x', content: '' }).decision).toBe('allow');
    expect(e.decide(bashTool, { command: 'ls' }).decision).toBe('ask');
  });

  it('blocks mutating tools in plan mode', () => {
    const e = new PermissionEngine({ mode: 'plan' });
    expect(e.decide(writeTool, { file_path: 'x', content: '' }).decision).toBe('deny');
    expect(e.decide(readTool, { file_path: 'x' }).decision).toBe('allow');
  });

  it('allows everything in bypass mode', () => {
    const e = new PermissionEngine({ mode: 'bypassPermissions' });
    expect(e.decide(bashTool, { command: 'rm -rf /' }).decision).toBe('allow');
  });

  it('honors allow rules and deny-wins precedence', () => {
    const allow = new PermissionEngine({ mode: 'default', allow: ['Bash(npm run *)'] });
    expect(allow.decide(bashTool, { command: 'npm run build' }).decision).toBe('allow');
    expect(allow.decide(bashTool, { command: 'rm file' }).decision).toBe('ask');

    const deny = new PermissionEngine({ mode: 'bypassPermissions', deny: ['Bash(git push)'] });
    expect(deny.decide(bashTool, { command: 'git push' }).decision).toBe('deny');
  });

  it('remembers session "always" grants', () => {
    const e = new PermissionEngine({ mode: 'default' });
    expect(e.decide(writeTool, { file_path: 'x', content: '' }).decision).toBe('ask');
    e.grants.allowAlways('Write', { file_path: 'x' }, 'tool');
    expect(e.decide(writeTool, { file_path: 'y', content: '' }).decision).toBe('allow');
  });
});
