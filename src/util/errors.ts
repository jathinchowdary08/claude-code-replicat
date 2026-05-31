/**
 * Typed error hierarchy. Every error the agent raises should be an {@link AppError}
 * so the CLI/TUI can format it for the user instead of crashing with a raw stack.
 */

export type ErrorCode =
  | 'TOOL_ERROR'
  | 'PERMISSION_DENIED'
  | 'CONFIG_ERROR'
  | 'LLM_ERROR'
  | 'CANCELLED'
  | 'VALIDATION_ERROR'
  | 'SANDBOX_VIOLATION'
  | 'UNKNOWN';

export interface AppErrorOptions {
  code?: ErrorCode;
  /** Structured detail for logs (never shown verbatim to the user). */
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(message: string, opts: AppErrorOptions = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.code = opts.code ?? 'UNKNOWN';
    this.details = opts.details;
    // Preserve prototype chain when targeting ES2022 with downleveled classes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ToolError extends AppError {
  constructor(message: string, opts: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...opts, code: 'TOOL_ERROR' });
  }
}

export class PermissionDeniedError extends AppError {
  constructor(message: string, opts: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...opts, code: 'PERMISSION_DENIED' });
  }
}

export class ConfigError extends AppError {
  constructor(message: string, opts: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...opts, code: 'CONFIG_ERROR' });
  }
}

export class LLMError extends AppError {
  /** HTTP status, when the failure originated from the API. */
  readonly status?: number;
  constructor(message: string, opts: Omit<AppErrorOptions, 'code'> & { status?: number } = {}) {
    super(message, { ...opts, code: 'LLM_ERROR' });
    this.status = opts.status;
  }
}

export class CancelError extends AppError {
  constructor(message = 'Operation cancelled', opts: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...opts, code: 'CANCELLED' });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, opts: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...opts, code: 'VALIDATION_ERROR' });
  }
}

export class SandboxViolationError extends AppError {
  constructor(message: string, opts: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...opts, code: 'SANDBOX_VIOLATION' });
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function isCancel(err: unknown): boolean {
  if (err instanceof CancelError) return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

/** Coerce any thrown value into a normalized message for display. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** A short, user-facing one-liner for the CLI/TUI. */
export function formatError(err: unknown): string {
  if (err instanceof AppError) {
    const prefix = err.code === 'UNKNOWN' ? 'Error' : err.code.replace(/_/g, ' ').toLowerCase();
    return `${prefix}: ${err.message}`;
  }
  return `error: ${errorMessage(err)}`;
}
