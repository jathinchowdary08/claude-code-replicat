/** Persist permission rules into a settings.json file (used by `/permissions allow|deny`). */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { settingsSchema, type Settings } from './schema.js';

function readSettings(path: string): Settings {
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    if (parsed.success) return parsed.data;
  } catch {
    /* missing or invalid — start fresh */
  }
  return { permissions: { allow: [], deny: [] } };
}

/**
 * Add a permission rule to `path`, creating the file/dir if needed. Idempotent
 * (a rule already present is not duplicated). Returns the updated rule list.
 */
export function addPermissionRule(path: string, kind: 'allow' | 'deny', rule: string): string[] {
  const current = readSettings(path);
  const permissions = {
    allow: current.permissions?.allow ?? [],
    deny: current.permissions?.deny ?? [],
  };
  const list = permissions[kind];
  if (!list.includes(rule)) list.push(rule);
  const next: Settings = { ...current, permissions };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return list;
}
