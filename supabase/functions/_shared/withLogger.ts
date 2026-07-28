/**
 * withLogger — Structured per-request logger for edge functions.
 *
 * WHAT: Tiny JSON logger that stamps every line with request_id, function name,
 *       and a millisecond elapsed counter from request start. Output goes to
 *       stdout/stderr so Supabase log drains pick it up.
 * WHERE: Instantiate once per request inside an edge function handler, ideally
 *        right after withErrorEnvelope wraps the handler.
 * WHY: 289 edge functions currently invent their own logging idioms. A shared
 *      shape makes log search (by request_id) and aggregate metrics tractable.
 *      Pairs with the request_id stamped by errorEnvelope so a client toast's
 *      "Ref: abc12345" maps directly to the server-side trace.
 *
 * Usage:
 *   const log = createLogger(req, 'my-function');
 *   log.info('processing', { rows: 42 });
 *   log.error('upstream failed', { code: 'TIMEOUT' });
 */

import { getRequestId } from './errorEnvelope.ts';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  requestId: string;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Elapsed ms since the logger was created. */
  elapsedMs(): number;
}

export function createLogger(req: Request, fn: string): Logger {
  const requestId = getRequestId(req);
  const startedAt = Date.now();

  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    const line = {
      ts: new Date().toISOString(),
      level,
      fn,
      request_id: requestId,
      elapsed_ms: Date.now() - startedAt,
      msg,
      ...(fields ?? {}),
    };
    const serialized = JSON.stringify(line);
    if (level === 'error' || level === 'warn') {
      console.error(serialized);
    } else {
      console.log(serialized);
    }
  };

  return {
    requestId,
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    elapsedMs: () => Date.now() - startedAt,
  };
}
