/**
 * withTimeout — Bounded async operations for edge functions.
 *
 * WHAT: Wraps a promise (or fetch) with an AbortController-backed timeout
 *       so external calls cannot hang the function past a known deadline.
 * WHERE: Use inside any edge function that calls third-party APIs, LLMs,
 *        crawlers, or long-running database operations.
 * WHY: Per the n8n/edge-function invariants, "all external calls must be
 *      time-bounded" and a function stuck running is a failure. This is the
 *      shared primitive so every caller doesn't reinvent AbortController plumbing.
 *
 * Usage:
 *   // Generic promise timeout
 *   const result = await withTimeout(somePromise, 5000, 'enrich-call');
 *
 *   // Fetch with timeout
 *   const res = await fetchWithTimeout('https://api.example.com/x', { method: 'GET' }, 8000);
 */

export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Race a promise against a timeout. Throws TimeoutError on expiry.
 * If `signal` is provided, it will be aborted when the timeout fires
 * so the underlying operation (e.g. fetch) can cancel cleanly.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
  signal?: AbortController,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        signal?.abort();
      } catch {
        // ignore
      }
      reject(new TimeoutError(label, ms));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * fetch with a hard deadline. Wires an AbortController into the request
 * and translates abort errors into TimeoutError for consistent handling.
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  ms = 10_000,
  label = 'fetch',
): Promise<Response> {
  const controller = new AbortController();
  // Preserve any caller-supplied signal by aborting our controller when it fires.
  const existing = init.signal;
  if (existing) {
    if (existing.aborted) controller.abort();
    else existing.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new TimeoutError(label, ms);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
