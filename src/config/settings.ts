/** Layered settings: built-in defaults < user (~/.agent) < project (.agent/). */
import { readFileSync } from 'node:fs';
import { logger } from '../util/logger.js';
import { settingsSchema, type Settings } from './schema.js';
import { projectSettingsPath, userSettingsPath } from './paths.js';

function readJsonIfExists(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    logger.warn(`Ignoring invalid settings file ${path}:`, err);
    return undefined;
  }
}

function mergeLayer(base: Settings, raw: unknown, source: string): Settings {
  if (raw === undefined) return base;
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn(`Ignoring invalid settings in ${source}:`, parsed.error.issues.map((i) => i.message).join('; '));
    return base;
  }
  const layer = parsed.data;
  return {
    ...base,
    ...layer,
    permissions: {
      allow: [...(base.permissions?.allow ?? []), ...(layer.permissions?.allow ?? [])],
      deny: [...(base.permissions?.deny ?? []), ...(layer.permissions?.deny ?? [])],
    },
    env: { ...(base.env ?? {}), ...(layer.env ?? {}) },
    hooks: { ...(base.hooks ?? {}), ...(layer.hooks ?? {}) },
  };
}

export function loadSettings(cwd: string): Settings {
  const defaults: Settings = { permissions: { allow: [], deny: [] } };
  let settings = mergeLayer(defaults, readJsonIfExists(userSettingsPath()), 'user settings');
  settings = mergeLayer(settings, readJsonIfExists(projectSettingsPath(cwd)), 'project settings');

  // Apply settings.env into the process environment (does not override existing values).
  for (const [k, v] of Object.entries(settings.env ?? {})) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return settings;
}
