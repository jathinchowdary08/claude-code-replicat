/**
 * Gathers an environment block (cwd, git, platform, date) for the system prompt.
 * Deliberately filesystem-only (no `git` subprocess) so it never slows startup —
 * spawning git here previously blocked the UI from painting, badly on Windows.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveModel } from '../llm/models.js';

/** Walk up from cwd to find a `.git` entry; returns its path or null. */
function findGitDir(cwd: string): string | null {
  let dir = cwd;
  for (;;) {
    if (existsSync(join(dir, '.git'))) return join(dir, '.git');
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Read the current branch from `.git/HEAD` without spawning git. */
function branchFromHead(gitDir: string): string | undefined {
  try {
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    return ref ? ref[1] : head.slice(0, 12); // detached HEAD → short sha
  } catch {
    return undefined;
  }
}

export interface EnvInfo {
  cwd: string;
  platform: NodeJS.Platform;
  date: string;
  isRepo: boolean;
  gitBranch?: string;
}

export function gatherEnvironment(cwd: string): EnvInfo {
  const gitDir = findGitDir(cwd);
  return {
    cwd,
    platform: process.platform,
    date: new Date().toISOString().slice(0, 10),
    isRepo: gitDir !== null,
    gitBranch: gitDir ? branchFromHead(gitDir) : undefined,
  };
}

export function environmentBlock(cwd: string, model: string): string {
  const env = gatherEnvironment(cwd);
  const m = resolveModel(model);
  const lines = [
    'Here is information about the environment you are running in:',
    '<env>',
    `Working directory: ${env.cwd}`,
    `Platform: ${env.platform}`,
    `Today's date: ${env.date}`,
    `Model: ${m.label} (${m.id})`,
    `Is a git repo: ${env.isRepo ? 'yes' : 'no'}`,
  ];
  if (env.gitBranch) lines.push(`Git branch: ${env.gitBranch}`);
  lines.push('</env>');
  return lines.join('\n');
}
