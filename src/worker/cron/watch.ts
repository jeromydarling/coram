/**
 * Scheduled watch-list poll.
 *
 * Every six hours, for every workspace with at least one active source and one
 * active topic. Runs as coram_cron, which is BYPASSRLS, because the sweep spans
 * every tenant — the same shape as the retention sweep, and the same care
 * required for the same reason.
 *
 * ---------------------------------------------------------------------------
 * BYPASSRLS means the tenant boundary is this file's job
 * ---------------------------------------------------------------------------
 *
 * On the request path a mistake in a WHERE clause is caught by a policy. Here
 * there is no policy, so every statement `pollTenant` runs is scoped by an
 * explicit tenant_id passed in from the loop below, and the loop gets its ids
 * from a single query over watch_sources. A source belongs to exactly one
 * workspace and the items it produces are written with that workspace's id —
 * there is no path here that reads one tenant's data while writing another's.
 *
 * ---------------------------------------------------------------------------
 * A slow upstream must not stop the sweep
 * ---------------------------------------------------------------------------
 *
 * A council's server that hangs for twelve seconds is not an error, it is a
 * Tuesday. Each tenant is polled inside its own try, and a failure is recorded
 * against that workspace's sources and logged, never thrown — one city's broken
 * feed cannot be allowed to mean nobody else gets their bills.
 *
 * The whole run is bounded: TENANT_BUDGET workspaces per firing, oldest-polled
 * first. Four firings a day at that budget is more headroom than the product
 * has workspaces, and when it stops being so the bound is the thing that keeps
 * the job finishing inside a cron invocation rather than being silently killed
 * halfway with no record of where it got to.
 */

import type { Env } from '../env';
import { close, connectAsCron } from '../lib/rls';
import { pollTenant, type PollReport } from '../routes/api/watch';

/** Workspaces per firing. See the header note. */
const TENANT_BUDGET = 200;

export interface WatchSweepReport {
  tenants: number;
  polled: number;
  found: number;
  errors: number;
}

export async function runWatchPoll(env: Env): Promise<WatchSweepReport> {
  const sql = connectAsCron(env);
  const report: WatchSweepReport = { tenants: 0, polled: 0, found: 0, errors: 0 };

  try {
    /*
     * Oldest first, and only workspaces that can actually produce a match.
     *
     * The topic join is not an optimisation. Polling a workspace with no active
     * topics means fetching a council's agenda and discarding every line of it,
     * which is a request to somebody else's server made for no reason.
     */
    const tenants = await sql<{ tenant_id: string }[]>`
      SELECT s.tenant_id
      FROM public.watch_sources s
      WHERE s.active
        AND EXISTS (
          SELECT 1 FROM public.watch_topics t
          WHERE t.tenant_id = s.tenant_id AND t.active
        )
      GROUP BY s.tenant_id
      ORDER BY min(coalesce(s.last_polled_at, 'epoch'::timestamptz))
      LIMIT ${TENANT_BUDGET}
    `;

    for (const { tenant_id } of tenants) {
      report.tenants += 1;
      try {
        const result: PollReport = await sql.begin((tx) => pollTenant(env, tx, tenant_id));
        report.polled += result.polled;
        report.found += result.found;
        report.errors += result.failures.length;
      } catch (error) {
        // One workspace's failure is not the sweep's failure. Logged with the
        // tenant id and nothing else — there is nothing else here worth logging.
        report.errors += 1;
        console.error('watch poll: tenant %s failed', tenant_id, error);
      }
    }
  } finally {
    await close(sql);
  }

  console.log(
    'watch poll: %d workspace(s), %d source(s), %d new item(s), %d failure(s)',
    report.tenants,
    report.polled,
    report.found,
    report.errors,
  );

  return report;
}
