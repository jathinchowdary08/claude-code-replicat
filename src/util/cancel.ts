/**
 * Cancellation plumbing. A single AbortController per turn is threaded into the
 * LLM stream and every tool so `esc` / ctrl-c produce a clean, prompt cancel.
 */
import { CancelError } from './errors.js';

export interface CancelScope {
  readonly signal: AbortSignal;
  cancel(reason?: string): void;
  readonly cancelled: boolean;
}

export function createCancelScope(parent?: AbortSignal): CancelScope {
  const controller = new AbortController();
  if (parent) {
    if (parent.aborted) controller.abort(parent.reason);
    else parent.addEventListener('abort', () => controller.abort(parent.reason), { once: true });
  }
  return {
    signal: controller.signal,
    cancel: (reason?: string) => controller.abort(reason ?? new CancelError()),
    get cancelled() {
      return controller.signal.aborted;
    },
  };
}

/** Throw a CancelError if the signal has been aborted. */
export function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new CancelError();
  }
}

/** Resolve a promise, but reject early with CancelError if the signal aborts. */
export function withCancel<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new CancelError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new CancelError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
