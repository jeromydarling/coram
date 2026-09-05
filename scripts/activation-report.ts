/**
 * Did anyone besides the founding steward ever show up?
 *
 * Run: PGURI=postgres://... npx tsx scripts/activation-report.ts
 *
 * A premortem on why groups sign up and then churn named the number worth
 * watching: not signups, but whether three distinct people from the same
 * workspace logged in within two weeks of it existing. Nothing was watching
 * that number before this script, because nothing needed `memberships`'
 * `first_login_on` populated before now — see 0020_workspace_invites.sql for
 * the write path, and src/worker/lib/activation.ts for the rule this script
 * only fetches rows for.
 *
 * ---------------------------------------------------------------------------
 * Why a script and not a Worker cron
 * ---------------------------------------------------------------------------
 *
 * Same reasoning as refdata:sync (see that file's own header): this reads
 * across every tenant at once, is not request-path work, and a person is the
 * intended reader — there is nowhere in the product today that would show
 * this to anyone, and building that screen is a larger, separate decision
 * about whether founders' own metrics belong inside the app they are
 * measuring. Until that decision is made, printing a report is the entire
 * scope this needed.
 *
 * ---------------------------------------------------------------------------
 * Why `coram_cron`, not the database owner
 * ---------------------------------------------------------------------------
 *
 * refdata:sync connects as the owner because it writes reference tables that
 * belong to no tenant. This script only ever reads two columns each off
 * `tenants` and `memberships` — exactly what `coram_cron` already holds
 * (BYPASSRLS, SELECT on both, granted in 0001_foundation.sql for the nightly
 * sweep) and nothing more. A report script asking for owner access it does
 * not need is the same mistake this project's own security page promises the
 * product itself does not make.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

import { summarizeActivation, type WorkspaceActivity } from '../src/worker/lib/activation';

neonConfig.webSocketConstructor = ws;

/** Just the surface this script uses — see refdata:sync's identical note. */
interface Client {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release: () => void;
}

async function fetchWorkspaceActivity(c: Client): Promise<WorkspaceActivity[]> {
  const { rows } = await c.query(`
    SELECT
      t.id            AS tenant_id,
      t.name          AS tenant_name,
      t.created_at    AS created_at,
      -- One element per membership row, in the shape activation.ts expects:
      -- an ISO date, or null for a person who has never logged in.
      jsonb_agg(m.first_login_on ORDER BY m.created_at) AS first_login_dates
    FROM public.tenants t
    JOIN public.memberships m ON m.tenant_id = t.id
    GROUP BY t.id, t.name, t.created_at
    ORDER BY t.created_at
  `);

  return rows.map((r) => ({
    tenantId: r.tenant_id as string,
    tenantName: r.tenant_name as string,
    createdAt: (r.created_at as Date).toISOString(),
    firstLoginDates: (r.first_login_dates as Array<string | null>) ?? [],
  }));
}

async function main() {
  const uri = process.env.PGURI;
  if (!uri) throw new Error('Set PGURI to a connection string for a role with SELECT on tenants and memberships.');

  const pool = new Pool({ connectionString: uri });
  const c = (await pool.connect()) as unknown as Client;

  try {
    const workspaces = await fetchWorkspaceActivity(c);
    const summary = summarizeActivation(workspaces);

    console.log(`${summary.judged} workspace(s) old enough to judge, ${summary.tooNew} still inside their window.`);
    if (summary.judged === 0) {
      console.log('Nothing to report yet.');
      return;
    }

    const rate = Math.round((summary.activated / summary.judged) * 100);
    console.log(`${summary.activated}/${summary.judged} activated (${rate}%) — three or more people arrived within two weeks.`);

    if (summary.notActivated.length === 0) {
      console.log('Every workspace old enough to judge cleared the bar.');
      return;
    }

    console.log(`\n${summary.notActivated.length} did not, oldest first:\n`);
    for (const v of summary.notActivated) {
      const days = Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 86_400_000);
      console.log(
        `  ${v.tenantName}  (created ${v.createdAt.slice(0, 10)}, ${days}d ago)  ` +
          `— ${v.arrivedWithinWindow} arrived in the window`,
      );
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
