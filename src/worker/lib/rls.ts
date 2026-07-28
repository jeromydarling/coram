/**
 * rls — the only way this Worker talks to Postgres.
 *
 * There is exactly one entry point for request handlers, `withTenant`, and it
 * opens a transaction, installs the request context, and runs your callback
 * inside it. That shape is not a convenience wrapper; it is the mechanism that
 * makes §4.1 true:
 *
 *   - The context is set with SET LOCAL semantics, so it dies with the
 *     transaction. Hyperdrive pools connections, and a GUC that outlived its
 *     transaction would leak one tenant's scope into the next request on the
 *     same connection. This is the single sharpest edge in the whole design.
 *
 *   - The callback receives the transaction handle and nothing else. There is
 *     no ambient `sql` a handler could reach for by accident, and therefore no
 *     way to run an unscoped query without visibly asking for one.
 *
 * §4.2 says there is no service-role query path in any request handler. That is
 * enforced here by construction: `withoutTenant` exists for the auth path and
 * for cron, and it still connects as coram_app — it simply has no tenant
 * context, so RLS denies every table. All it can reach are the SECURITY
 * DEFINER functions that were explicitly granted.
 */

import postgres from 'postgres';

import type { Env } from '../env';
import type { Session } from './auth';

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

/**
 * A fresh client per request. Hyperdrive does the actual connection pooling on
 * its side, so this is cheap; what it buys us is that a client can never be
 * shared between two requests with different tenants.
 *
 * Callers must pass the result to `close()` via ctx.waitUntil.
 */
export function connect(env: Env): Sql {
  return client(env.HYPERDRIVE.connectionString);
}

/**
 * The service-role path, as coram_cron. BYPASSRLS, so nothing below is
 * tenant-scoped and every query must scope itself.
 *
 * Call this from cron handlers and queue consumers only. §4.2 puts it out of
 * bounds for request handlers, and the binding is separate so that rule is
 * enforced by what a handler can reach rather than by convention.
 */
export function connectAsCron(env: Env): Sql {
  return client(env.HYPERDRIVE_CRON.connectionString);
}

function client(connectionString: string): Sql {
  return postgres(connectionString, {
    // Hyperdrive already pools. Keep the per-isolate number small.
    max: 5,
    // Skip the type-introspection round trip on first query.
    fetch_types: false,
    // Workers has no long-lived process to keep sockets warm for.
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export function close(sql: Sql): Promise<void> {
  return sql.end({ timeout: 5 }).catch(() => undefined);
}

export class TenancyError extends Error {}

/**
 * Run `fn` inside a transaction scoped to the session's user and workspace.
 *
 * Postgres re-derives role and turf from `memberships` and raises
 * insufficient_privilege if the pair does not exist — so a session naming a
 * workspace the user was removed from fails here rather than reading rows.
 */
export async function withTenant<T>(
  sql: Sql,
  session: Session,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const tenantId = session.tenantId;
  if (!tenantId) {
    throw new TenancyError('This session has not selected a workspace.');
  }

  return sql.begin(async (tx) => {
    try {
      await tx`SELECT coram.set_request_context(${session.userId}::uuid, ${tenantId}::uuid)`;
    } catch (err) {
      if (isInsufficientPrivilege(err)) {
        throw new TenancyError('No membership for that user in that workspace.');
      }
      throw err;
    }
    return fn(tx);
  }) as Promise<T>;
}

/**
 * Run `fn` with no tenant context. Every RLS-protected table denies reads here;
 * this is only useful for the SECURITY DEFINER functions in the `coram` schema.
 *
 * Used by signup, login and password reset, which by definition happen before
 * a workspace has been chosen.
 */
export function withoutTenant<T>(sql: Sql, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql.begin((tx) => fn(tx)) as Promise<T>;
}

function isInsufficientPrivilege(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '42501';
}
