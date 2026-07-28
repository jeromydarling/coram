/**
 * /api/exports/* — full export in a documented, non-proprietary format (§5.1).
 *
 * This route is a promise being kept, not a feature. The pitch is that a group
 * can leave, so the export has to be complete enough to actually leave with:
 * contacts, tags, consent history, custom field definitions, and the sealed
 * notes. Anything held back would make the promise a lie.
 *
 * §4.1 says an organizer "cannot export globally". Note there is no check for
 * that below, and none is needed — an organizer's SELECT is turf-bounded by
 * `contacts_select`, so their export contains their turf and stops there. The
 * constraint is structural rather than remembered.
 *
 * Format and stability guarantees: docs/export-format.md
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { ok } from '../../lib/http';
import { close, connect, withTenant } from '../../lib/rls';

export const exports = new Hono<{ Bindings: Env; Variables: Vars }>();

exports.use('*', requireWorkspace);

/** Bump on a breaking change to the shape. Documented in docs/export-format.md. */
export const EXPORT_FORMAT_VERSION = 1;

// ---------------------------------------------------------------------------
// GET /api/exports/contacts.json
// ---------------------------------------------------------------------------

exports.get('/contacts.json', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const data = await withTenant(sql, session, async (tx) => {
    const [workspace] = await tx`SELECT name, slug, tier FROM public.tenants`;

    const contacts = await tx`
      SELECT c.id, c.display_name, c.email, c.phone, c.postal_code,
             c.custom_fields, c.last_interaction_at, c.created_at, c.updated_at,
             t.name AS turf,
             coalesce(
               (SELECT array_agg(tg.name ORDER BY tg.name)
                FROM public.contact_tags ct
                JOIN public.tags tg ON tg.id = ct.tag_id
                WHERE ct.contact_id = c.id),
               '{}'
             ) AS tags,
             coalesce(
               (SELECT jsonb_agg(jsonb_build_object(
                  'channel', cr.channel, 'granted', cr.granted,
                  'acquisition', cr.acquisition, 'occurredAt', cr.occurred_at
                ) ORDER BY cr.occurred_at)
                FROM public.consent_records cr WHERE cr.contact_id = c.id),
               '[]'::jsonb
             ) AS consent
      FROM public.contacts c
      LEFT JOIN public.turfs t ON t.id = c.turf_id
      ORDER BY c.created_at
    `;

    const customFields = await tx`
      SELECT key, label, field_type, options FROM public.custom_field_defs ORDER BY key
    `;

    // Ciphertext. Included because an export that dropped the notes would be
    // an export a group cannot actually leave with — and because the key is
    // theirs, so the blobs are useful to them and to nobody else. The reader
    // needs the passphrase and the vault record below to open them.
    const notes = await tx`
      SELECT contact_id, ciphertext, nonce, key_id, created_at
      FROM public.contact_notes ORDER BY created_at
    `;

    const vaultKeys = await tx`
      SELECT id, wrapped_dek, wrap_nonce, kdf_salt, kdf_iterations, created_at, retired_at
      FROM public.vault_keys ORDER BY created_at
    `;

    await record(tx, {
      action: 'record.export',
      recordType: 'contact',
      recordCount: contacts.length,
    });

    return { workspace, contacts, customFields, notes, vaultKeys };
  });

  const body = {
    format: 'coram.export.contacts',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: {
      name: data.workspace?.name,
      slug: data.workspace?.slug,
      tier: data.workspace?.tier,
    },
    customFields: data.customFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.field_type,
      options: f.options,
    })),
    contacts: data.contacts.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      postalCode: row.postal_code,
      turf: row.turf,
      tags: row.tags,
      customFields: row.custom_fields,
      consent: row.consent,
      lastInteractionAt: row.last_interaction_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    encryptedNotes: data.notes.map((row) => ({
      contactId: row.contact_id,
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      keyId: row.key_id,
      createdAt: row.created_at,
    })),
    vaultKeys: data.vaultKeys.map((row) => ({
      id: row.id,
      wrappedDek: row.wrapped_dek,
      wrapNonce: row.wrap_nonce,
      kdfSalt: row.kdf_salt,
      kdfIterations: row.kdf_iterations,
      createdAt: row.created_at,
      retiredAt: row.retired_at,
    })),
  };

  return c.json(body, 200, {
    'Content-Disposition': `attachment; filename="coram-contacts-${today()}.json"`,
  });
});

// ---------------------------------------------------------------------------
// GET /api/exports/contacts.csv
//
// The lossy one, and labelled as such. CSV cannot carry consent history or
// sealed notes, so it is offered for spreadsheets rather than for leaving.
// ---------------------------------------------------------------------------

exports.get('/contacts.csv', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withTenant(sql, session, async (tx) => {
    const found = await tx`
      SELECT c.display_name, c.email, c.phone, c.postal_code, t.name AS turf,
             coalesce(
               (SELECT string_agg(tg.name, '; ' ORDER BY tg.name)
                FROM public.contact_tags ct
                JOIN public.tags tg ON tg.id = ct.tag_id
                WHERE ct.contact_id = c.id),
               ''
             ) AS tags,
             c.created_at
      FROM public.contacts c
      LEFT JOIN public.turfs t ON t.id = c.turf_id
      ORDER BY c.created_at
    `;

    await record(tx, { action: 'record.export', recordType: 'contact', recordCount: found.length });
    return found;
  });

  const header = ['name', 'email', 'phone', 'postal_code', 'turf', 'tags', 'created_at'];
  const body = [
    header.join(','),
    ...rows.map((r) =>
      [r.display_name, r.email, r.phone, r.postal_code, r.turf, r.tags, r.created_at]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');

  return c.text(body, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="coram-contacts-${today()}.csv"`,
  });
});

// ---------------------------------------------------------------------------
// GET /api/exports/aggregates — the observer's door (§4.1)
// ---------------------------------------------------------------------------

exports.get('/aggregates', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  // An observer has no SELECT policy on contacts at all, so this SECURITY
  // DEFINER function is the only way they see anything. It returns counts.
  const [totals] = await withTenant(sql, session, (tx) => tx`SELECT * FROM coram.contact_aggregates()`);

  return c.json(
    ok({
      total: Number(totals?.total ?? 0),
      withEmail: Number(totals?.with_email ?? 0),
      withPhone: Number(totals?.with_phone ?? 0),
      tagged: Number(totals?.tagged ?? 0),
    }),
  );
});

// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * RFC 4180 quoting, plus a guard against spreadsheet formula injection: a cell
 * starting with = + - @ is prefixed with a quote so Excel and Sheets treat it
 * as text. Without it, an imported contact named `=HYPERLINK(...)` becomes a
 * live formula in whatever spreadsheet an organizer opens the export in.
 */
function csvCell(value: unknown): string {
  if (value == null) return '';

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
