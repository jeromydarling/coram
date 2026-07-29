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
  /** Present outside production only. See `err()`. */
  detail?: string;
  ok: false;
  error: string;
  code: ErrorCode;
  request_id: string;
}

export function ok<T>(data?: T, extra?: Record<string, unknown>): Ok<T> & Record<string, unknown> {
  return data === undefined ? { ok: true, ...extra } : { ok: true, data, ...extra };
}

export function err(
  message: string,
  code: ErrorCode,
  requestId: string,
  /**
   * Underlying cause, echoed only outside production.
   *
   * A 500 carrying nothing but a request id is unactionable for the caller and
   * undiagnosable for us when the platform's log stream is unavailable — which
   * is how a hard PBKDF2 iteration cap in the runtime presented as "Could not
   * create that workspace" and nothing else. In production this stays absent:
   * driver messages name hosts, roles and columns.
   */
  detail?: string,
): Err {
  return detail === undefined
    ? { ok: false, error: message, code, request_id: requestId }
    : { ok: false, error: message, code, request_id: requestId, detail };
}

/** The cause to hand `err()`, or undefined when running in production. */
export function detailFor(env: { ENVIRONMENT: string }, error: unknown): string | undefined {
  if (env.ENVIRONMENT === 'production') return undefined;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reuse an inbound x-request-id so a trace survives a hop, otherwise mint one.
 * Eight hex characters is plenty to correlate a log line with a support email
 * and short enough that someone can read it over the phone.
 */
export function requestId(req: Request): string {
  return req.headers.get('x-request-id') || crypto.randomUUID().slice(0, 8);
}

/**
 * Log a failure that is about to become a 500.
 *
 * Every internal error was previously swallowed by a bare `} catch {`, which
 * meant a production 500 arrived with a request id and nothing behind it —
 * unactionable for the person on the other end and undiagnosable for us. §10
 * forbids analytics, not operational logs; what it forbids is logging content,
 * so this deliberately records the scope, the request id and the error's own
 * message, and never the request body, the query parameters, or anything a
 * caller supplied.
 */
export function logFailure(scope: string, requestId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}] rid=${requestId} ${message}`);
}
