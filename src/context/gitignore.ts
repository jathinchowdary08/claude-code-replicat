/** Minimal .gitignore support: returns fast-glob-compatible ignore patterns. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function toGlob(pattern: string): string | null {
  let p = pattern.trim();
  if (!p || p.startsWith('#')) return null;
  if (p.startsWith('!')) return null; // negations unsupported (best effort)
  const trailingSlash = p.endsWith('/');
  if (p.startsWith('/')) p = p.slice(1);
  if (trailingSlash) p = p.slice(0, -1);
  // A bare name with no slash matches at any depth.
  const glob = p.includes('/') ? p : `**/${p}`;
  return trailingSlash ? `${glob}/**` : glob;
}

export function loadIgnorePatterns(root: string): string[] {
  let content: string;
  try {
    content = readFileSync(join(root, '.gitignore'), 'utf8');
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const line of content.split('\n')) {
    const g = toGlob(line);
    if (g) out.push(g);
  }
  return out;
}
