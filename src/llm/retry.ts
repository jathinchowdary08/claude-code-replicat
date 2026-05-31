/** Exponential backoff with jitter for transient API failures. */
import { isCancel } from '../util/errors.js';
import { logger } from '../util/logger.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND']);

export function isRetryable(err: unknown): boolean {
  if (isCancel(err)) return false;
  const e = err as { status?: number; code?: string; error?: { type?: string } };
  if (typeof e?.status === 'number' && RETRYABLE_STATUS.has(e.status)) return true;
  if (e?.code && RETRYABLE_CODES.has(e.code)) return true;
  if (e?.error?.type === 'overloaded_error') return true;
  return false;
}

/** Pull a `retry-after` (seconds) hint off an error's headers, if present. */
function retryAfterMs(err: unknown): number | null {
  const headers = (err as { headers?: Record<string, string> })?.headers;
  const raw = headers?.['retry-after'];
  if (!raw) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) ? secs * 1000 : null;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      },
      { once: true },
    );
  });
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const base = opts.baseDelayMs ?? 500;
  const max = opts.maxDelayMs ?? 16_000;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const hinted = retryAfterMs(err);
      const backoff = Math.min(max, base * 2 ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.25;
      const delay = hinted ?? backoff + jitter;
      logger.warn(`API call failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delay)}ms`);
      await sleep(delay, opts.signal);
    }
  }
  throw lastErr;
}
