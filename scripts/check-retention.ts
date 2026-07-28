/**
 * CI gate for §3.4: "A migration that adds PII without a retention rule must
 * fail CI."
 *
 * Reads every CREATE TABLE out of /migrations and checks it against the
 * retention registry in the Worker. Three ways to fail:
 *
 *   1. a table exists in SQL but is not registered
 *   2. a table is registered but no longer exists in SQL
 *   3. a registered table names a timestamp or tenant column the SQL lacks
 *
 * The third catches the failure that would otherwise be silent: a rule that
 * looks fine in review, and a nightly sweep that errors on every run against a
 * column that was renamed a month ago.
 *
 * Run: npm run check:retention
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { allRules } from '../src/worker/lib/retention';
import '../src/worker/lib/schema';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

interface ParsedTable {
  name: string;
  columns: Set<string>;
  file: string;
}

function parseMigrations(): Map<string, ParsedTable> {
  const tables = new Map<string, ParsedTable>();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    // CREATE TABLE public.foo ( ... );  — body captured up to the closing
    // paren that sits at the start of a line, which is how these are formatted.
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(\w+)\s*\(([\s\S]*?)^\);/gim;

    for (const match of sql.matchAll(re)) {
      const [, name, body] = match;
      const columns = new Set<string>();

      for (const rawLine of body.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('--')) continue;
        // Table-level constraints, not columns.
        if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|EXCLUDE)\b/i.test(line)) continue;

        const column = line.match(/^(\w+)\s+/);
        if (column) columns.add(column[1]);
      }

      tables.set(name, { name, columns, file });
    }

    // ALTER TABLE ... ADD COLUMN, so a column added by a later migration is
    // still seen by the checks below.
    const alterRe = /ALTER\s+TABLE\s+(?:ONLY\s+)?public\.(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
    for (const [, table, column] of sql.matchAll(alterRe)) {
      tables.get(table)?.columns.add(column);
    }
  }

  return tables;
}

function main(): void {
  const tables = parseMigrations();
  const rules = allRules();
  const registered = new Map(rules.map((r) => [r.table, r]));
  const problems: string[] = [];

  for (const [name, table] of tables) {
    const rule = registered.get(name);
    if (!rule) {
      problems.push(
        `${name} (${table.file}) is created in SQL but not registered with retention.ts.\n` +
          `    Add a registerTable({ table: '${name}', ... }) call beside its definition in ` +
          `src/worker/lib/schema.ts. §3.4 does not allow a table to exist without a stated ` +
          `retention position.`,
      );
      continue;
    }

    if (!table.columns.has(rule.timestampColumn)) {
      problems.push(
        `${name} declares timestampColumn "${rule.timestampColumn}", which does not exist in ` +
          `${table.file}. The nightly sweep would fail on this table every night.`,
      );
    }
    if (!table.columns.has(rule.tenantColumn)) {
      problems.push(
        `${name} declares tenantColumn "${rule.tenantColumn}", which does not exist in ${table.file}.`,
      );
    }
    for (const column of rule.anonymizeColumns ?? []) {
      if (!table.columns.has(column)) {
        problems.push(`${name} declares anonymizeColumn "${column}", which does not exist in ${table.file}.`);
      }
    }
  }

  for (const rule of rules) {
    if (!tables.has(rule.table)) {
      problems.push(
        `${rule.table} is registered with retention.ts but no migration creates it. ` +
          `Either the migration is missing or the registration is stale.`,
      );
    }
  }

  if (problems.length) {
    console.error(`\nRetention check failed — ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  - ${problem}\n`);
    process.exit(1);
  }

  const identifying = rules.filter((r) => r.pii === 'contact' || r.pii === 'protected');
  console.log(
    `Retention check passed. ${tables.size} table(s), ${identifying.length} holding ` +
      `directly identifying data, all registered and swept.`,
  );
}

main();
