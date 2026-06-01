/** Environment / build-freshness checks for the `/doctor` command. */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** True if any .ts/.tsx under `srcDir` is newer than `distFile` (a rebuild is needed). */
export function isBuildStale(srcDir: string, distFile: string): boolean {
  if (!existsSync(distFile)) return true;
  const distMtime = statSync(distFile).mtimeMs;
  let newest = 0;
  const walk = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) newest = Math.max(newest, st.mtimeMs);
    }
  };
  walk(srcDir);
  return newest > distMtime;
}

export function buildDoctorReport(cwd: string, version = '0.1.0'): string {
  const dist = join(cwd, 'dist', 'index.js');
  const src = join(cwd, 'src');
  const lines = [
    `agent-code ${version}`,
    `node ${process.version} · ${process.platform}`,
    `cwd: ${cwd}`,
  ];
  if (!existsSync(dist)) {
    lines.push('build: dist/index.js not found — run `npm run build`.');
  } else if (isBuildStale(src, dist)) {
    lines.push('build: STALE — src is newer than dist. Run `npm run build` (then relink/reinstall acode).');
  } else {
    lines.push('build: up to date.');
  }
  return lines.join('\n');
}
