/**
 * retention — the registry every table must enter before it can hold data.
 *
 * CLAUDE.md §3.4: every table containing PII carries a retention rule and is
 * swept by the nightly purge. A migration that adds PII without a retention
 * rule fails CI (see scripts/check-retention.ts).
 *
 * This file is deliberately the first thing in the Worker. It exists so that
 * "what do we keep, and for how long" is answerable by reading one file rather
 * than by auditing every migration. If a third-party pen test asks us to
 * justify a stored field, the answer is the `reason` string on its table.
 *
 * Registration happens at module load: each schema file calls registerTable()
 * next to its table definition, so a table cannot exist without a declared
 * stance on retention.
 */

/**
 * How sensitive the rows are. This drives both the purge sweep and what the
 * audit log is permitted to record about them.
 *
 *   none      — no personal data at all (config, counters, tenant metadata)
 *   pseudonym — identifies a person only in combination with another table
 *               (user ids, membership rows, envelope metadata)
 *   contact   — directly identifies a person (name, email, phone, address)
 *   protected — contact data whose exposure carries physical or legal risk to
 *               the person. Custos rows are the only ones that qualify.
 *
 * Classify by the *subject* of the row, not by every column in it.
 *
 * An event has a `created_by`, and a segment has one too, but neither row is
 * about that person — they are about an event and a saved filter, and the
 * reference is authorship. Those are `none`. An RSVP is about a person even
 * though it holds only a contact id, so it is `pseudonym`.
 *
 * The test to apply: if this row were deleted, would a *person* have less data
 * held about them, or would the workspace have lost a piece of its own
 * configuration? The first is personal data; the second is not.
 */
export type PiiClass = 'none' | 'pseudonym' | 'contact' | 'protected';

/**
 * What the nightly sweep does when a row ages out.
 *
 *   delete    — the row goes. No soft-delete, no tombstone.
 *   anonymize — the row survives with its identifying columns nulled, because
 *               an aggregate depends on its existence (e.g. an attendance
 *               count that must not silently change after a purge).
 */
export type PurgeStrategy = 'delete' | 'anonymize';

export interface RetentionRule {
  /** Unqualified table name, as it appears in Postgres. */
  table: string;
  /**
   * Days a row may live after `timestampColumn`. `null` means the row lives as
   * long as the workspace does — permitted only for `pii: 'none'` tables, and
   * enforced below.
   */
  retentionDays: number | null;
  pii: PiiClass;
  /** Column the sweep measures age against. */
  timestampColumn: string;
  /** Tenant scoping column. Every table has one (§4.2). */
  tenantColumn: string;
  purge: PurgeStrategy;
  /** Columns nulled when `purge` is 'anonymize'. Must be empty otherwise. */
  anonymizeColumns?: string[];
  /**
   * Why this data is stored at all. Required. If you cannot write a sentence
   * naming the shipped feature that breaks without this table, the table
   * should not exist (§3, rule 4).
   */
  reason: string;
}

const registry = new Map<string, RetentionRule>();

/**
 * Longest retention we will accept for directly identifying data without an
 * explicit override. Two years is already generous for organizing work; the
 * cap exists so that "forever" is never the accidental default.
 */
const MAX_CONTACT_RETENTION_DAYS = 730;

export class RetentionError extends Error {}

/**
 * Register a table's retention stance. Throws at module load — and therefore
 * at deploy — rather than failing quietly at sweep time.
 */
export function registerTable(rule: RetentionRule): RetentionRule {
  if (registry.has(rule.table)) {
    throw new RetentionError(`Table "${rule.table}" is registered twice.`);
  }
  if (!rule.reason.trim()) {
    throw new RetentionError(
      `Table "${rule.table}" has no reason. Name the shipped feature that breaks without it.`,
    );
  }

  const identifying = rule.pii === 'contact' || rule.pii === 'protected';

  if (rule.retentionDays === null && rule.pii !== 'none') {
    throw new RetentionError(
      `Table "${rule.table}" holds ${rule.pii} data and must declare retentionDays. ` +
        `Indefinite retention is only available to pii: 'none' tables.`,
    );
  }
  if (rule.retentionDays !== null && rule.retentionDays <= 0) {
    throw new RetentionError(`Table "${rule.table}" has a non-positive retentionDays.`);
  }
  if (identifying && rule.retentionDays !== null && rule.retentionDays > MAX_CONTACT_RETENTION_DAYS) {
    throw new RetentionError(
      `Table "${rule.table}" keeps ${rule.pii} data for ${rule.retentionDays} days, over the ` +
        `${MAX_CONTACT_RETENTION_DAYS}-day cap. Raising the cap is a product decision, not a schema one.`,
    );
  }

  if (rule.purge === 'anonymize') {
    if (!rule.anonymizeColumns?.length) {
      throw new RetentionError(`Table "${rule.table}" purges by anonymize but names no columns to null.`);
    }
  } else if (rule.anonymizeColumns?.length) {
    throw new RetentionError(`Table "${rule.table}" purges by delete but also names anonymizeColumns.`);
  }

  registry.set(rule.table, rule);
  return rule;
}

export function getRule(table: string): RetentionRule | undefined {
  return registry.get(table);
}

export function allRules(): RetentionRule[] {
  return [...registry.values()];
}

/** Tables the nightly sweep touches: everything with a finite retention. */
export function sweepableRules(): RetentionRule[] {
  return allRules().filter((r) => r.retentionDays !== null);
}

/**
 * Every registered table, for the burn switch. The burn switch ignores
 * retention entirely — it destroys the workspace's rows regardless of age —
 * but it needs the table list, and this registry is the only complete one.
 */
export function allRegisteredTables(): string[] {
  return allRules().map((r) => r.table);
}

/**
 * The SQL a sweep would run for one table, as a parameterized statement.
 *
 * Table and column names are interpolated because Postgres does not accept
 * them as bind parameters. They are safe to interpolate here for a reason
 * worth stating: they come from this registry, which is a compile-time
 * constant in the Worker bundle, never from a request. The identifier guard
 * below enforces that even so.
 */
export function sweepStatement(rule: RetentionRule): { sql: string; cutoffDays: number } {
  if (rule.retentionDays === null) {
    throw new RetentionError(`Table "${rule.table}" has no finite retention and is not sweepable.`);
  }

  const table = ident(rule.table);
  const ts = ident(rule.timestampColumn);

  if (rule.purge === 'delete') {
    return {
      sql: `DELETE FROM ${table} WHERE ${ts} < now() - ($1 || ' days')::interval`,
      cutoffDays: rule.retentionDays,
    };
  }

  const sets = rule.anonymizeColumns!.map((c) => `${ident(c)} = NULL`).join(', ');
  return {
    sql:
      `UPDATE ${table} SET ${sets} ` +
      `WHERE ${ts} < now() - ($1 || ' days')::interval ` +
      // Don't rewrite rows that are already anonymized — otherwise every
      // sweep churns the whole historical table for no reason.
      `AND ${ident(rule.anonymizeColumns![0])} IS NOT NULL`,
    cutoffDays: rule.retentionDays,
  };
}

/** Postgres identifiers, quoted. Rejects anything that isn't a plain name. */
function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new RetentionError(`Refusing to build SQL for suspicious identifier: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

/** Test seam only. Never call from request or cron paths. */
export function __resetRegistryForTests(): void {
  registry.clear();
}
