/**
 * Executes user-configured shell hooks on lifecycle events. A PreToolUse hook that
 * exits with code 2 blocks the tool call (its stdout becomes the reason).
 */
import { spawn } from 'node:child_process';
import { logger } from '../util/logger.js';
import type { HookConfig, HookEvent, HookOutcome, HooksConfig } from './types.js';

export class HookRunner {
  constructor(
    private readonly hooks: HooksConfig,
    private readonly cwd: string,
  ) {}

  private matching(event: HookEvent, toolName?: string): HookConfig[] {
    const list = this.hooks[event] ?? [];
    if (!toolName) return list;
    return list.filter((h) => {
      if (!h.matcher) return true;
      try {
        return new RegExp(h.matcher).test(toolName);
      } catch {
        return false;
      }
    });
  }

  /** Run all hooks for an event. Returns a blocking outcome if any PreToolUse hook blocks. */
  async run(event: HookEvent, payload: unknown, toolName?: string): Promise<HookOutcome> {
    const hooks = this.matching(event, toolName);
    let outcome: HookOutcome = { block: false };
    for (const hook of hooks) {
      const result = await this.exec(hook, payload).catch((err) => {
        logger.warn(`hook failed (${event}):`, err);
        return null;
      });
      if (!result) continue;
      if (event === 'PreToolUse' && result.code === 2) {
        outcome = { block: true, reason: result.stdout.trim() || 'Blocked by a PreToolUse hook.' };
        break;
      }
      if (result.stdout.trim()) outcome.reason = result.stdout.trim();
    }
    return outcome;
  }

  private exec(hook: HookConfig, payload: unknown): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(hook.command, { shell: true, cwd: this.cwd, env: process.env });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => proc.kill(), hook.timeout ?? 30_000);
      proc.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
      proc.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      try {
        proc.stdin?.end(JSON.stringify(payload ?? {}));
      } catch {
        /* ignore */
      }
    });
  }
}
