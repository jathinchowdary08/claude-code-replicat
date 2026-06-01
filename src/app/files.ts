/** Project file enumeration for `@`-mention autocomplete in the input box. */
import fg from 'fast-glob';
import { loadIgnorePatterns } from '../context/gitignore.js';

const IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**'];
const LIMIT = 5000;

/** Relative file paths under `cwd`, respecting common ignores and .gitignore. */
export function listProjectFiles(cwd: string): string[] {
  try {
    return fg
      .sync('**/*', {
        cwd,
        onlyFiles: true,
        dot: false,
        suppressErrors: true,
        ignore: [...IGNORE, ...loadIgnorePatterns(cwd)],
      })
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}
