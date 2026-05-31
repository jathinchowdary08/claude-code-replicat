/**
 * Tracks background shells started with Bash `run_in_background`. BashOutput reads
 * incremental output; KillShell terminates them; the app kills all on exit.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';

export type ShellStatus = 'running' | 'completed' | 'failed' | 'killed';

const MAX_BUFFER = 5_000_000; // cap retained output per stream (~5 MB)

export interface BackgroundShell {
  id: string;
  command: string;
  proc: ChildProcess;
  stdout: string;
  stderr: string;
  status: ShellStatus;
  exitCode: number | null;
  startedAt: number;
  /** Read cursor for incremental BashOutput reads. */
  cursor: number;
}

export interface ShellOutputChunk {
  stdout: string;
  stderr: string;
  status: ShellStatus;
  exitCode: number | null;
}

function cap(s: string): string {
  return s.length > MAX_BUFFER ? s.slice(s.length - MAX_BUFFER) : s;
}

export class ShellManager {
  private shells = new Map<string, BackgroundShell>();

  start(command: string, opts: { cwd: string; env?: NodeJS.ProcessEnv }): BackgroundShell {
    const proc = spawn(command, {
      shell: true,
      cwd: opts.cwd,
      env: opts.env ?? process.env,
    });
    const shell: BackgroundShell = {
      id: `bash_${randomBytes(4).toString('hex')}`,
      command,
      proc,
      stdout: '',
      stderr: '',
      status: 'running',
      exitCode: null,
      startedAt: Date.now(),
      cursor: 0,
    };
    proc.stdout?.on('data', (d: Buffer) => {
      shell.stdout = cap(shell.stdout + d.toString());
    });
    proc.stderr?.on('data', (d: Buffer) => {
      shell.stderr = cap(shell.stderr + d.toString());
    });
    proc.on('error', (err) => {
      shell.stderr = cap(`${shell.stderr}\n${err.message}`);
      shell.status = 'failed';
    });
    proc.on('close', (code) => {
      shell.exitCode = code;
      if (shell.status === 'running') shell.status = code === 0 ? 'completed' : 'failed';
    });
    this.shells.set(shell.id, shell);
    return shell;
  }

  get(id: string): BackgroundShell | undefined {
    return this.shells.get(id);
  }

  list(): BackgroundShell[] {
    return [...this.shells.values()];
  }

  /** Return output appended since the last read (advances the cursor over stdout). */
  readNew(id: string, filter?: RegExp): ShellOutputChunk | undefined {
    const shell = this.shells.get(id);
    if (!shell) return undefined;
    let stdout = shell.stdout.slice(shell.cursor);
    shell.cursor = shell.stdout.length;
    if (filter) {
      stdout = stdout
        .split('\n')
        .filter((line) => filter.test(line))
        .join('\n');
    }
    return {
      stdout,
      stderr: shell.stderr,
      status: shell.status,
      exitCode: shell.exitCode,
    };
  }

  kill(id: string): boolean {
    const shell = this.shells.get(id);
    if (!shell) return false;
    if (shell.status === 'running') {
      shell.status = 'killed';
      try {
        // Kill the whole process tree on Windows; SIGTERM elsewhere.
        if (process.platform === 'win32' && shell.proc.pid !== undefined) {
          spawn('taskkill', ['/pid', String(shell.proc.pid), '/t', '/f']);
        } else {
          shell.proc.kill('SIGTERM');
        }
      } catch {
        /* best effort */
      }
    }
    return true;
  }

  killAll(): void {
    for (const id of this.shells.keys()) this.kill(id);
  }
}
