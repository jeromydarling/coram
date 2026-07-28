/**
 * Nightly retention sweep (§3.4).
 *
 * Walks every table registered with retention.ts and removes rows past their
 * declared window. The registry is the only input — there is no separate list
 * of tables to sweep that could fall out of step with the schema, which is the
 * whole reason registration happens at table-definition time.
 *
 * Runs as coram_cron (BYPASSRLS) because the sweep spans every tenant at once.
 */

import type { Env } from '../env';
import { close, connectAsCron } from '../lib/rls';
import { sweepableRules, sweepStatement } from '../lib/retention';
import '../lib/schema'; // side-effect import: registers every table

export interface SweepReport {
  table: string;
  affected: number;
  error?: string;
}

export async function runRetentionSweep(env: Env): Promise<SweepReport[]> {
  const sql = connectAsCron(env);
  const reports: SweepReport[] = [];

  try {
    for (const rule of sweepableRules()) {
      const { sql: statement, cutoffDays } = sweepStatement(rule);
      try {
        // postgres.js `unsafe` takes a pre-built statement string. The
        // statement comes from the compiled registry and its identifiers pass
        // retention.ts's ident() guard; the cutoff is a bind parameter.
        const result = await sql.unsafe(statement, [String(cutoffDays)]);
        reports.push({ table: rule.table, affected: result.count ?? 0 });
      } catch (error) {
        // One bad table must not stop the rest of the sweep. A table that
        // silently stops being swept is exactly the failure §3.4 is guarding
        // against, so this is reported rather than swallowed.
        reports.push({
          table: rule.table,
          affected: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await close(sql);
  }

  const failed = reports.filter((r) => r.error);
  if (failed.length) {
    console.error('retention sweep: %d table(s) failed', failed.length, failed);
  }
  console.log(
    'retention sweep: %d table(s), %d row(s) removed',
    reports.length,
    reports.reduce((n, r) => n + r.affected, 0),
  );

  return reports;
}
