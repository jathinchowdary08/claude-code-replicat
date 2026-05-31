/** Cross-platform config/data path resolution. */
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const ROOT_DIR_NAME = '.agent';

export function userConfigDir(): string {
  return join(homedir(), ROOT_DIR_NAME);
}

export function userSettingsPath(): string {
  return join(userConfigDir(), 'settings.json');
}

export function projectConfigDir(cwd: string): string {
  return join(cwd, ROOT_DIR_NAME);
}

export function projectSettingsPath(cwd: string): string {
  return join(projectConfigDir(cwd), 'settings.json');
}

export function logsDir(): string {
  return join(userConfigDir(), 'logs');
}

/** A stable per-project key derived from the absolute cwd. */
export function projectKey(cwd: string): string {
  return createHash('sha256').update(resolve(cwd)).digest('hex').slice(0, 16);
}

export function sessionsDir(cwd: string): string {
  return join(userConfigDir(), 'projects', projectKey(cwd));
}
