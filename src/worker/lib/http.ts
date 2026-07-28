/**
 * http — the response envelope every API route uses.
 *
 * Shape carried over from the previous codebase, where ~200 handlers each
 * inventing their own error format was a real source of drift:
 *
 *   success  { ok: true,  data?, ...extra }
 *   failure  { ok: false, error, code, request_id }
 *
 * `code` is machine-readable and stable; `error` is human-readable and may be
 * reworded freely. Clients branch on `code`.
 */

export const ERROR = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  VALIDATION: 'validation_failed',
  RATE_LIMITED: 'rate_limited',
  CONFLICT: 'conflict',
  NO_WORKSPACE: 'no_workspace',
  INTERNAL: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR)[keyof typeof ERROR];

export interface Ok<T> {
  ok: true;
  data?: T;
}

export interface Err {
  ok: false;
  error: string;
  code: ErrorCode;
  request_id: string;
}

export function ok<T>(data?: T, extra?: Record<string, unknown>): Ok<T> & Record<string, unknown> {
  return data === undefined ? { ok: true, ...extra } : { ok: true, data, ...extra };
}

export function err(message: string, code: ErrorCode, requestId: string): Err {
  return { ok: false, error: message, code, request_id: requestId };
}

/**
 * Reuse an inbound x-request-id so a trace survives a hop, otherwise mint one.
 * Eight hex characters is plenty to correlate a log line with a support email
 * and short enough that someone can read it over the phone.
 */
export function requestId(req: Request): string {
  return req.headers.get('x-request-id') || crypto.randomUUID().slice(0, 8);
}
