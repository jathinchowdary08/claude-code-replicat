/**
 * Filesystem helpers: a path sandbox (all tool file access is confined to allowed
 * roots, with symlink-breakout protection), atomic writes, and text/binary sniffing.
 */
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { SandboxViolationError } from './errors.js';

const isWin = process.platform === 'win32';

/** Resolve the realpath of the longest existing prefix, re-appending the rest. */
export function realpathBestEffort(p: string): string {
  let current = resolve(p);
  const tail: string[] = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    tail.unshift(basename(current));
    current = parent;
  }
  let real = current;
  try {
    real = realpathSync(current);
  } catch {
    /* fall back to the normalized path */
  }
  return tail.length ? join(real, ...tail) : real;
}

function normForCompare(p: string): string {
  const n = resolve(p);
  return isWin ? n.toLowerCase() : n;
}

/** True if `child` is `root` or nested within it. */
export function isInsideRoot(root: string, child: string): boolean {
  const rel = relative(normForCompare(root), normForCompare(child));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export class PathSandbox {
  readonly roots: string[];

  constructor(roots: string[]) {
    const resolved = (roots.length ? roots : [process.cwd()]).map((r) => realpathBestEffort(r));
    this.roots = resolved;
  }

  private get primaryRoot(): string {
    return this.roots[0] ?? realpathBestEffort(process.cwd());
  }

  /**
   * Resolve `input` (absolute or relative to `cwd`/primary root) to a real absolute
   * path, throwing {@link SandboxViolationError} if it escapes every allowed root.
   */
  resolve(input: string, cwd?: string): string {
    const base = cwd ? realpathBestEffort(cwd) : this.primaryRoot;
    const abs = isAbsolute(input) ? resolve(input) : resolve(base, input);
    const real = realpathBestEffort(abs);
    if (!this.roots.some((root) => isInsideRoot(root, real))) {
      throw new SandboxViolationError(
        `Path "${input}" resolves outside the allowed roots (${this.roots.join(', ')}).`,
      );
    }
    return real;
  }

  contains(p: string): boolean {
    const real = realpathBestEffort(p);
    return this.roots.some((root) => isInsideRoot(root, real));
  }
}

/** Write a file atomically (temp file in the same dir + rename). */
export async function atomicWrite(path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(tmp, content);
    await rename(tmp, path);
  } catch (err) {
    // Best-effort cleanup of the temp file on failure.
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/** Heuristic binary detection: null bytes or a high ratio of control characters. */
export function isProbablyBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  if (len === 0) return false;
  let suspicious = 0;
  for (let i = 0; i < len; i++) {
    const b = buf[i]!;
    if (b === 0) return true;
    if (b < 7 || (b > 13 && b < 32)) suspicious++;
  }
  return suspicious / len > 0.3;
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

export function isImagePath(p: string): boolean {
  const dot = p.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXTS.has(p.slice(dot).toLowerCase());
}
