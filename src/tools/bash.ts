import { z } from 'zod';
import { spawn, type ChildProcess } from 'node:child_process';
import { CancelError } from '../util/errors.js';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  command: z.string().describe('The shell command to execute.'),
  timeout: z
    .number()
    .int()
    .positive()
    .max(600_000)
    .optional()
    .describe('Timeout in milliseconds (default 120000, max 600000).'),
  run_in_background: z
    .boolean()
    .optional()
    .default(false)
    .describe('Run detached; returns a shell id. Read output later with BashOutput.'),
  description: z.string().optional().describe('A 5-10 word description of what the command does.'),
});

type Input = z.infer<typeof schema>;

const DEFAULT_TIMEOUT = 120_000;
const MAX_OUTPUT = 30_000;

// Commands that need a TTY and would hang the agent.
const INTERACTIVE = /\b(vi|vim|nano|emacs|less|more|top|htop|man)\b|\bgit\s+(rebase|add|commit)\s+(-i|--interactive)\b/;

function killTree(proc: ChildProcess): void {
  try {
    if (process.platform === 'win32' && proc.pid !== undefined) {
      spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f']);
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    /* best effort */
  }
}

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT) return s;
  const head = s.slice(0, MAX_OUTPUT);
  return `${head}\n… [output truncated, ${s.length - MAX_OUTPUT} more characters]`;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

function execForeground(command: string, cwd: string, timeoutMs: number, signal: AbortSignal): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new CancelError());
    const proc = spawn(command, { shell: true, cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      killTree(proc);
      cleanup();
      reject(new CancelError());
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(proc);
    }, timeoutMs);

    signal.addEventListener('abort', onAbort, { once: true });

    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
      if (stdout.length > MAX_OUTPUT * 2) stdout = stdout.slice(-MAX_OUTPUT * 2);
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > MAX_OUTPUT * 2) stderr = stderr.slice(-MAX_OUTPUT * 2);
    });
    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ stdout, stderr, code, timedOut });
    });
  });
}

export const bashTool: Tool<Input> = {
  name: 'Bash',
  schema,
  readOnly: false,
  description: [
    'Execute a shell command. Persistent working directory is the session cwd.',
    'Use `run_in_background` for long-running processes (dev servers, watchers) and',
    'read their output later with BashOutput. Avoid interactive commands (they will be',
    'refused). Prefer the dedicated Read/Glob/Grep tools over cat/find/grep.',
  ].join(' '),
  prompt: (i) => i.description ?? i.command,
  async run(input, ctx, signal) {
    if (INTERACTIVE.test(input.command)) {
      return errorResult(
        'This command appears to require interactive input, which is not supported. Use a non-interactive flag (e.g. `git commit -m`, `git rebase` without -i).',
      );
    }

    if (input.run_in_background) {
      const shell = ctx.shells.start(input.command, { cwd: ctx.cwd });
      return textResult(`Started background shell \`${shell.id}\`. Use BashOutput to read its output.`, {
        title: `Background: ${input.description ?? input.command}`,
      });
    }

    const timeoutMs = input.timeout ?? DEFAULT_TIMEOUT;
    const { stdout, stderr, code, timedOut } = await execForeground(input.command, ctx.cwd, timeoutMs, signal);

    const parts: string[] = [];
    if (stdout.trim()) parts.push(stdout.replace(/\s+$/, ''));
    if (stderr.trim()) parts.push(stderr.replace(/\s+$/, ''));
    let out = parts.join('\n');
    if (timedOut) out += `${out ? '\n' : ''}[command timed out after ${timeoutMs}ms]`;
    else if (code && code !== 0) out += `${out ? '\n' : ''}[exit code ${code}]`;
    if (!out) out = `[no output] (exit code ${code ?? 0})`;

    return textResult(truncate(out), {
      isError: timedOut || (code !== null && code !== 0),
      title: input.description ?? input.command,
    });
  },
};
