/**
 * Lightweight leveled logger. Writes to stderr (so it never corrupts print-mode
 * stdout) and, when a log file is configured, appends redacted lines there too.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import chalk from 'chalk';
import { redact } from './redact.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

interface LoggerState {
  level: LogLevel;
  file: string | null;
}

const state: LoggerState = {
  level: process.env.DEBUG ? 'debug' : 'warn',
  file: null,
};

export function configureLogger(opts: { level?: LogLevel; file?: string | null }): void {
  if (opts.level) state.level = opts.level;
  if (opts.file !== undefined) {
    state.file = opts.file;
    if (opts.file) {
      try {
        mkdirSync(dirname(opts.file), { recursive: true });
      } catch {
        /* best effort */
      }
    }
  }
}

function enabled(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[state.level];
}

function fmtArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function emit(level: Exclude<LogLevel, 'silent'>, color: (s: string) => string, args: unknown[]): void {
  if (!enabled(level)) return;
  const line = redact(args.map(fmtArg).join(' '));
  const ts = new Date().toISOString();
  // Console output (colored, no timestamp clutter).
  process.stderr.write(`${color(`[${level}]`)} ${line}\n`);
  // File output (plain, timestamped).
  if (state.file) {
    try {
      appendFileSync(state.file, `${ts} [${level}] ${line}\n`);
    } catch {
      /* best effort */
    }
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', chalk.gray, args),
  info: (...args: unknown[]) => emit('info', chalk.cyan, args),
  warn: (...args: unknown[]) => emit('warn', chalk.yellow, args),
  error: (...args: unknown[]) => emit('error', chalk.red, args),
};
