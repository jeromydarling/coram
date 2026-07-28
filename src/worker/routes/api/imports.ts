/**
 * /api/imports/* — CSV import with column mapping, dry-run preview, and
 * rollback (§5.1).
 *
 * The rows travel with both the preview and the commit and are never stored in
 * between. Parking an uploaded list of people in R2 or KV between two requests
 * would make a second copy of exactly the data §3 is most careful about, with
 * its own retention story to get wrong. Sending it twice is the cheaper
 * problem, and it means an abandoned import leaves nothing behind at all.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { ERROR, err, ok } from '../../lib/http';
import { close, connect, withTenant, type Tx } from '../../lib/rls';
import { contactHashes } from '../../lib/suppression';
import { isReachable, mapRow } from '../../../shared/importers/contactRows';
import {
  importCommitSchema,
  importPreviewSchema,
  type ImportableField,
  type ImportPreview,
  type ImportPreviewRow,
} from '../../../shared/schemas/contacts';

export const imports = new Hono<{ Bindings: Env; Variables: Vars }>();

imports.use('*', requireWorkspace);

// ---------------------------------------------------------------------------
// POST /api/imports/preview — writes nothing
// ---------------------------------------------------------------------------

imports.post('/preview', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = importPreviewSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const preview = await withTenant(sql, session, (tx) =>
    buildPreview(tx, parsed.data.rows, parsed.data.mapping),
  );

  return c.json(ok(preview));
});

// ---------------------------------------------------------------------------
// POST /api/imports/commit
// ---------------------------------------------------------------------------

imports.post('/commit', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = importCommitSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const { label, mapping, rows, onDuplicate, turfId } = parsed.data;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    const result = await withTenant(sql, session, async (tx) => {
      // Re-run the preview inside the same transaction the writes happen in.
      // The client's earlier preview is a UI affordance; this is the one that
      // decides, and it cannot be raced by a concurrent import.
      const preview = await buildPreview(tx, rows, mapping);

      const over = preview.overContactLimit;
      if (over) return { kind: 'blocked' as const, blocked: over };

      const [batch] = await tx`
        INSERT INTO public.import_batches
          (tenant_id, label, status, row_count, created_by)
        VALUES (coram.current_tenant_id(), ${label}, 'previewed', ${rows.length}, coram.current_user_id())
        RETURNING id
      `;
      const batchId = batch.id as string;

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const [index, raw] of rows.entries()) {
        const mapped = mapRow(raw, mapping);
        const decision = preview.rows[index];

        if (!isReachable(mapped) || decision?.action === 'skip') {
          skipped++;
          continue;
        }

        if (decision?.action === 'update') {
          if (onDuplicate !== 'update') {
            skipped++;
            continue;
          }
          const done = await tx`
            UPDATE public.contacts SET
              display_name = coalesce(${mapped.displayName ?? null}, display_name),
              phone        = coalesce(${mapped.phone ?? null}, phone),
              postal_code  = coalesce(${mapped.postalCode ?? null}, postal_code)
            WHERE lower(email) = ${mapped.email!}
            RETURNING id
          `;
          // Zero rows means RLS declined — an organizer matched an email that
          // exists outside their turf. Counted as skipped, not failed: the
          // contact is genuinely there, just not theirs to touch.
          if (done.length) updated++;
          else skipped++;
          continue;
        }

        // An imported contact with no hash is one the opt-out ledger cannot
        // protect, and a bulk import is precisely where a previously
        // unsubscribed address comes back in.
        const hashes = await contactHashes(c.env, mapped);

        const done = await tx`
          INSERT INTO public.contacts
            (tenant_id, display_name, email, phone, postal_code, turf_id, import_batch_id,
             email_hash, phone_hash)
          VALUES (
            coram.current_tenant_id(),
            ${mapped.displayName ?? mapped.email ?? mapped.phone!},
            ${mapped.email ?? null},
            ${mapped.phone ?? null},
            ${mapped.postalCode ?? null},
            ${turfId ?? null},
            ${batchId}::uuid,
            ${hashes.emailHash}, ${hashes.phoneHash}
          )
          ON CONFLICT DO NOTHING
          RETURNING id
        `;
        if (done.length) created++;
        else skipped++;
      }

      await tx`
        UPDATE public.import_batches
        SET status = 'committed',
            created_count = ${created}, updated_count = ${updated}, skipped_count = ${skipped},
            committed_at = now()
        WHERE id = ${batchId}::uuid
      `;

      await record(tx, {
        action: 'record.export',
        recordType: 'contact_import',
        recordCount: created + updated,
      });

      return { kind: 'done' as const, batchId, created, updated, skipped };
    });

    if (result.kind === 'blocked') {
      return c.json(
        err(
          `This import would take the workspace past its ${result.blocked.limit}-contact limit. ` +
            `Nothing was imported.`,
          ERROR.CONFLICT,
          rid,
        ),
        409,
      );
    }

    return c.json(
      ok({
        batchId: result.batchId,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      }),
      201,
    );
  } catch {
    // The whole import is one transaction, so a failure here leaves no partial
    // batch behind — nothing to clean up and nothing half-imported.
    return c.json(err('The import failed and nothing was changed.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/imports
// ---------------------------------------------------------------------------

imports.get('/', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const batches = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT id, label, status, row_count, created_count, updated_count, skipped_count,
             created_at, committed_at
      FROM public.import_batches
      ORDER BY created_at DESC
      LIMIT 50
    `,
  );

  return c.json(ok(batches));
});

// ---------------------------------------------------------------------------
// POST /api/imports/:id/rollback
// ---------------------------------------------------------------------------

imports.post('/:id/rollback', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    const removed = await withTenant(sql, session, async (tx) => {
      const [row] = await tx`SELECT coram.rollback_import(${c.req.param('id')}::uuid) AS removed`;
      await record(tx, {
        action: 'record.export',
        recordType: 'contact_import_rollback',
        recordCount: Number(row.removed),
      });
      return Number(row.removed);
    });

    return c.json(
      ok(
        { removed },
        {
          // Said plainly rather than buried, because an organizer who assumes
          // otherwise will believe they have undone something they have not.
          message:
            `Removed ${removed} contact(s) this import created. Contacts it updated were ` +
            `not reverted — their previous values were not kept.`,
        },
      ),
    );
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P0002') {
      return c.json(err('No committed import by that id in this workspace.', ERROR.NOT_FOUND, rid), 404);
    }
    if (code === '42501') {
      return c.json(err('Not permitted to roll back an import.', ERROR.FORBIDDEN, rid), 403);
    }
    return c.json(err('Could not roll back that import.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------

/**
 * Decide what each row would do, without doing it.
 *
 * Runs the same way for preview and commit — see the note in
 * shared/importers/contactRows.ts on why those must not diverge.
 */
async function buildPreview(
  tx: Tx,
  rows: Array<Record<string, string>>,
  mapping: Record<string, ImportableField>,
): Promise<ImportPreview> {
  const mapped = rows.map((row) => mapRow(row, mapping));

  const emails = [...new Set(mapped.map((m) => m.email).filter((e): e is string => Boolean(e)))];

  // One query rather than one per row. Note this only returns contacts the
  // caller can see — so for an organizer, an email held outside their turf
  // reads as "new" here and then declines on insert. The unique index is what
  // actually prevents the duplicate; this is the fast path, not the guarantee.
  const existing = emails.length
    ? await tx`SELECT lower(email) AS email FROM public.contacts WHERE lower(email) = ANY(${emails})`
    : [];
  const known = new Set(existing.map((r) => r.email as string));

  // Duplicates *within the file* matter as much as duplicates against the
  // database — a CSV listing the same person twice would otherwise report two
  // creates and deliver one.
  const seenInFile = new Set<string>();

  const previewRows: ImportPreviewRow[] = mapped.map((m, i) => {
    const base = { row: i + 1, displayName: m.displayName, email: m.email };

    if (!isReachable(m)) {
      return { ...base, action: 'skip', reason: 'No name, email, or phone in this row.' };
    }
    if (m.email && seenInFile.has(m.email)) {
      return { ...base, action: 'skip', reason: 'This email appears earlier in the file.' };
    }
    if (m.email) seenInFile.add(m.email);

    if (m.email && known.has(m.email)) {
      return { ...base, action: 'update', reason: 'Already in this workspace.' };
    }
    return { ...base, action: 'create' };
  });

  const creates = previewRows.filter((r) => r.action === 'create').length;

  const [limits] = await tx`
    SELECT t.contact_count::bigint AS current, coram.contact_limit_for(t.tier)::bigint AS limit
    FROM public.tenants t WHERE t.id = coram.current_tenant_id()
  `;
  const current = Number(limits?.current ?? 0);
  const limit = Number(limits?.limit ?? Number.MAX_SAFE_INTEGER);

  return {
    total: rows.length,
    creates,
    updates: previewRows.filter((r) => r.action === 'update').length,
    skips: previewRows.filter((r) => r.action === 'skip').length,
    rows: previewRows,
    ...(current + creates > limit
      ? { overContactLimit: { limit, current, wouldAdd: creates } }
      : {}),
  };
}
