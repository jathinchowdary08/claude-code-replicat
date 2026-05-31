/**
 * Loads project context files (AGENTS.md / CLAUDE.md) from the cwd up the directory
 * tree, plus any extra roots, to seed the agent with project-specific guidance.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const CONTEXT_FILES = ['AGENTS.md', 'CLAUDE.md'];
const MAX_BYTES = 32_000;

function tryRead(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Walk from cwd up to the filesystem root, collecting the first context file per dir. */
function collectUpTree(cwd: string): Array<{ path: string; content: string }> {
  const found: Array<{ path: string; content: string }> = [];
  let dir = cwd;
  for (;;) {
    for (const name of CONTEXT_FILES) {
      const p = join(dir, name);
      const content = tryRead(p);
      if (content) {
        found.push({ path: p, content });
        break;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Root-most first, cwd-most last (closest wins precedence by appearing last).
  return found.reverse();
}

export function loadProjectContext(cwd: string, addDirs: string[] = []): string {
  const files = collectUpTree(cwd);
  for (const root of addDirs) {
    for (const name of CONTEXT_FILES) {
      const p = join(root, name);
      const content = tryRead(p);
      if (content) {
        files.push({ path: p, content });
        break;
      }
    }
  }
  if (files.length === 0) return '';

  let budget = MAX_BYTES;
  const sections: string[] = [];
  for (const f of files) {
    if (budget <= 0) break;
    const body = f.content.length > budget ? `${f.content.slice(0, budget)}\n… [truncated]` : f.content;
    budget -= body.length;
    const label = relative(cwd, f.path) || f.path;
    sections.push(`Contents of ${label} (project context):\n\n${body}`);
  }
  return sections.join('\n\n---\n\n');
}
