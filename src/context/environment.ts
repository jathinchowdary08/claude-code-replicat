/** Gathers an environment block (cwd, git, platform, date) for the system prompt. */
import { execFileSync } from 'node:child_process';
import { resolveModel } from '../llm/models.js';

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export interface EnvInfo {
  cwd: string;
  platform: NodeJS.Platform;
  date: string;
  isRepo: boolean;
  gitBranch?: string;
  gitStatusShort?: string;
}

export function gatherEnvironment(cwd: string): EnvInfo {
  const isRepo = git(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';
  const info: EnvInfo = {
    cwd,
    platform: process.platform,
    date: new Date().toISOString().slice(0, 10),
    isRepo,
  };
  if (isRepo) {
    info.gitBranch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) ?? undefined;
    const status = git(['status', '--short'], cwd);
    if (status) {
      const lines = status.split('\n');
      info.gitStatusShort = lines.length > 20 ? `${lines.slice(0, 20).join('\n')}\n… (${lines.length - 20} more)` : status;
    }
  }
  return info;
}

export function environmentBlock(cwd: string, model: string): string {
  const env = gatherEnvironment(cwd);
  const m = resolveModel(model);
  const lines = [
    'Here is information about the environment you are running in:',
    `<env>`,
    `Working directory: ${env.cwd}`,
    `Platform: ${env.platform}`,
    `Today's date: ${env.date}`,
    `Model: ${m.label} (${m.id})`,
    `Is a git repo: ${env.isRepo ? 'yes' : 'no'}`,
  ];
  if (env.gitBranch) lines.push(`Git branch: ${env.gitBranch}`);
  lines.push('</env>');
  if (env.gitStatusShort) {
    lines.push('', 'Git status (short):', '```', env.gitStatusShort, '```');
  }
  return lines.join('\n');
}
