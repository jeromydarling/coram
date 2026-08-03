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

/**
 * ---------------------------------------------------------------------------
 * `fetch_types: false` has a consequence worth knowing before you write a query
 * ---------------------------------------------------------------------------
 *
 * postgres.js learns array types by introspecting pg_type on first connect.
 * Skipping that saves a round trip on every isolate, which is why it is off —
 * but it also means there is no parser registered for `text[]` or `uuid[]`, so
 * an array column arrives as the literal Postgres string:
 *
 *     '{eviction,"unlawful detainer",lockout}'
 *
 * not as an array. Nothing errors. `.map` on it throws in the browser, and
 * anything that merely iterates it — a Set, a flatMap, an `includes` — silently
 * does the wrong thing and keeps going, which is far worse.
 *
 * So: select array columns as `to_jsonb(col) AS col`. JSON is parsed from a
 * built-in table that does not depend on introspection, and the cast makes the
 * intent visible at the query rather than in a type annotation three files
 * away.
 *
 * The same hole exists in the other direction, and it is the one that bites.
 * Passing a JS array as a bind parameter for a `text[]` column sends it
 * comma-joined and unbraced, and Postgres answers
 *
 *     malformed array literal: "public charge,inadmissibility"
 *
 * — so the write fails outright. Every insert of an array column therefore
 * builds the literal itself with `pgArray()` below and casts it:
 *
 *     ${pgArray(xs)}::text[]
 *
 * Routing through jsonb was tried first and is worse: the parameter comes back
 * out as a JSON scalar rather than an array ("cannot extract elements from a
 * scalar"), so it trades one silent encoding assumption for another. A literal
 * we write ourselves has no assumptions in it at all.
 *
 * jsonb has the same shape of problem and a different fix. A string bound for a
 * `::jsonb` cast is inferred as json and encoded *again*, so
 *
 *     ${JSON.stringify(items)}::jsonb
 *
 * arrives as a JSON string spelling an array rather than as the array — which
 * fails a `jsonb_typeof(...) = 'array'` CHECK, and silently stores a scalar
 * where there is no CHECK. Casting through text first is what makes the value
 * be parsed rather than re-encoded:
 *
 *     ${JSON.stringify(items)}::text::jsonb
 *
 * Neither direction is caught by a unit test, because a test that mocks the API
 * never speaks to Postgres — which is why `pgArray` is a plain function with
 * its own tests rather than an incantation repeated at six call sites.
 */

/**
 * Build a Postgres array literal from a list of strings.
 *
 * Every element is quoted, so an element containing a comma, a brace or a space
 * cannot change the shape of the literal — which matters here because these are
 * words a user typed into a box. Backslashes and double quotes are escaped
 * per Postgres's array-literal rules; nothing else needs to be.
 *
 * The result is bound as an ordinary parameter and cast at the call site, so it
 * is never string-concatenated into SQL.
 */
export function pgArray(values: readonly string[]): string {
  return `{${values
    .map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')}}`;
}
function client(connectionString: string): Sql {
  return postgres(connectionString, {
    // Hyperdrive already pools. Keep the per-isolate number small.
    max: 5,
    // Skip the type-introspection round trip on first query. See the note
    // above: this is why array columns are selected with to_jsonb().
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

/**
 * Whether Postgres refused a statement because a policy said no.
 *
 * Worth exporting, because the two halves of RLS fail differently and only one
 * of them is obvious. A denied SELECT, UPDATE or DELETE simply matches no rows,
 * so a route sees an empty result and says "no such thing" — which is usually
 * the right answer anyway. A denied INSERT *raises*, because WITH CHECK has
 * nothing to filter, and a route that only handles the first case reports a
 * permission refusal as an internal error.
 *
 * That is not a cosmetic difference. "Could not save your page" sends somebody
 * to look for a bug; "only a steward can publish this" tells them who to ask.
 */
export function isDenied(error: unknown): boolean {
  return isInsufficientPrivilege(error);
}
