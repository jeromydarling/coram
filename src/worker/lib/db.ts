/**
 * One Postgres client per request, closed once, after the handler is done.
 *
 * Every route used to open its own and then write:
 *
 *     const sql = connect(c.env);
 *     c.executionCtx.waitUntil(close(sql));
 *
 * which reads as "close this when the request is over" and is not what it
 * does. `close(sql)` is *called* immediately to produce the promise handed to
 * waitUntil, so the client began shutting down while the handler was still
 * querying it. postgres.js lets in-flight work finish but refuses anything
 * new, so a single-query route appeared to work and any route with a second
 * query died with `write CONNECTION_ENDED`. Signup failed on exactly that,
 * and the bare `catch {}` around it meant the reason never surfaced.
 *
 * Ownership now sits in one place: `db(c)` hands out the request's client, and
 * `closeRequestDb` closes it after `next()` resolves.
 */

import type { Context } from 'hono';

import type { Env, Vars } from '../env';
import { close, connect, type Sql } from './rls';

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

/** The client for this request, created on first call. */
export function db(c: Ctx): Sql {
  const existing = c.get('sql');
  if (existing) return existing;

  const sql = connect(c.env);
  c.set('sql', sql);
  return sql;
}

/**
 * Close the request's client, if one was ever created.
 *
 * Runs from middleware after the handler resolves, so nothing is still using
 * it. Routes that never touch the database never open a connection at all.
 */
export function closeRequestDb(c: Ctx): void {
  const sql = c.get('sql');
  if (!sql) return;
  c.set('sql', undefined);
  c.executionCtx.waitUntil(close(sql));
}
