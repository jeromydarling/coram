/**
 * /api/contacts/* — Membra (§5.1).
 *
 * Almost no authorization logic appears in this file, and that is the point.
 * Every query runs inside `withTenant`, so `contacts_select` and its siblings
 * decide what an organizer sees, what a member sees, and that an observer or
 * `legal` sees nothing. A handler that forgets a check returns no rows rather
 * than the wrong ones.
 *
 * Where TypeScript does appear below, it is turning "zero rows" into a decent
 * error message. That is the §4.1 division: the database decides, the handler
 * explains.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { ERROR, err, ok } from '../../lib/http';
import {withTenant} from '../../lib/rls';
import { db } from '../../lib/db';

import { contactHashes } from '../../lib/suppression';
import {
  createContactSchema,
  listContactsQuery,
  recordConsentSchema,
  sealedNoteSchema,
  updateContactSchema,
} from '../../../shared/schemas/contacts';

export const contacts = new Hono<{ Bindings: Env; Variables: Vars }>();

contacts.use('*', requireWorkspace);

// ---------------------------------------------------------------------------
// GET /api/contacts
// ---------------------------------------------------------------------------

contacts.get('/', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = listContactsQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const { q, turfId, tagId, limit, cursor } = parsed.data;

  const sql = db(c);

  const rows = await withTenant(sql, session, async (tx) => {
    const found = await tx`
      SELECT c.id, c.display_name, c.email, c.phone, c.postal_code,
             c.turf_id, c.custom_fields, c.last_interaction_at, c.created_at
      FROM public.contacts c
      WHERE ${q ? tx`(c.display_name ILIKE ${'%' + q + '%'}
                      OR c.email ILIKE ${'%' + q + '%'}
                      OR c.phone ILIKE ${'%' + q + '%'})` : tx`true`}
        AND ${turfId ? tx`c.turf_id = ${turfId}::uuid` : tx`true`}
        AND ${
          tagId
            ? tx`EXISTS (SELECT 1 FROM public.contact_tags ct
                         WHERE ct.contact_id = c.id AND ct.tag_id = ${tagId}::uuid)`
            : tx`true`
        }
        AND ${cursor ? tx`c.id > ${cursor}::uuid` : tx`true`}
      ORDER BY c.id
      LIMIT ${limit}
    `;

    // §3.6 — the count, never the values. This is the entry that lets a
    // steward tell a single lookup from someone paging the whole list.
    if (found.length) {
      await record(tx, { action: 'record.read', recordType: 'contact', recordCount: found.length });
    }

    return found;
  });

  return c.json(
    ok(rows, { nextCursor: rows.length === limit ? rows[rows.length - 1].id : null }),
  );
});

// ---------------------------------------------------------------------------
// POST /api/contacts
// ---------------------------------------------------------------------------

contacts.post('/', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = createContactSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  // The opt-out triggers in 0004 derive a recipient's ledger key from these
  // columns, so a contact written without them is a contact the ledger cannot
  // protect. Computed here because the pepper is a Worker secret.
  const { emailHash, phoneHash } = await contactHashes(c.env, input);

  try {
    const created = await withTenant(sql, session, async (tx) => {
      const [row] = await tx`
        INSERT INTO public.contacts
          (tenant_id, display_name, email, phone, postal_code, turf_id, custom_fields,
           email_hash, phone_hash)
        VALUES (
          coram.current_tenant_id(),
          ${input.displayName},
          ${input.email ?? null},
          ${input.phone ?? null},
          ${input.postalCode ?? null},
          ${input.turfId ?? null},
          -- ::text::jsonb — see lib/rls.ts. A bare ::jsonb arrives double-encoded.
          ${JSON.stringify(input.customFields)}::text::jsonb,
          ${emailHash}, ${phoneHash}
        )
        RETURNING id, display_name, email, phone, postal_code, turf_id, created_at
      `;
      return row;
    });

    return c.json(ok(created), 201);
  } catch (error) {
    return c.json(...contactWriteError(error, rid));
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/contacts/:id
// ---------------------------------------------------------------------------

contacts.patch('/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = updateContactSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;
  const id = c.req.param('id');

  const sql = db(c);

  // Only recomputed for the fields actually being changed. Passing null leaves
  // the stored hash alone, so editing a phone number cannot silently blank the
  // email hash and detach someone from their own opt-out.
  const { emailHash, phoneHash } = await contactHashes(c.env, input);

  try {
    const updated = await withTenant(sql, session, async (tx) => {
      // COALESCE so an omitted field keeps its value while an explicitly
      // cleared one can still be nulled through a dedicated clear action.
      const [row] = await tx`
        UPDATE public.contacts SET
          display_name = coalesce(${input.displayName ?? null}, display_name),
          email        = coalesce(${input.email ?? null}, email),
          phone        = coalesce(${input.phone ?? null}, phone),
          postal_code  = coalesce(${input.postalCode ?? null}, postal_code),
          turf_id      = coalesce(${input.turfId ?? null}::uuid, turf_id),
          custom_fields = coalesce(${input.customFields ? JSON.stringify(input.customFields) : null}::text::jsonb, custom_fields),
          email_hash   = coalesce(${emailHash}, email_hash),
          phone_hash   = coalesce(${phoneHash}, phone_hash)
        WHERE id = ${id}::uuid
        RETURNING id, display_name, email, phone, postal_code, turf_id, updated_at
      `;
      return row;
    });

    if (!updated) return c.json(err(notVisible, ERROR.NOT_FOUND, rid), 404);
    return c.json(ok(updated));
  } catch (error) {
    return c.json(...contactWriteError(error, rid));
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/contacts/:id
// ---------------------------------------------------------------------------

contacts.delete('/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const removed = await withTenant(sql, session, async (tx) => {
    const rows = await tx`DELETE FROM public.contacts WHERE id = ${id}::uuid RETURNING id`;
    if (rows.length) {
      await record(tx, { action: 'record.read', recordType: 'contact' });
    }
    return rows.length;
  });

  if (!removed) return c.json(err(notVisible, ERROR.NOT_FOUND, rid), 404);
  return c.json(ok());
});

// ---------------------------------------------------------------------------
// Consent ledger
// ---------------------------------------------------------------------------

contacts.get('/:id/consent', async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT id, channel, granted, acquisition, note, occurred_at
      FROM public.consent_records
      WHERE contact_id = ${id}::uuid
      ORDER BY occurred_at DESC
    `,
  );

  return c.json(ok(rows));
});

contacts.post('/:id/consent', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const parsed = recordConsentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  // Append-only. Withdrawing consent adds a row with granted = false; there is
  // no UPDATE policy on this table, so history cannot be rewritten.
  const inserted = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.consent_records
        (tenant_id, contact_id, channel, granted, acquisition, note, recorded_by)
      VALUES (
        coram.current_tenant_id(), ${id}::uuid, ${input.channel}, ${input.granted},
        ${input.acquisition}, ${input.note ?? null}, coram.current_user_id()
      )
      RETURNING id, channel, granted, acquisition, occurred_at
    `;
    return row;
  });

  if (!inserted) return c.json(err(notVisible, ERROR.NOT_FOUND, rid), 404);
  return c.json(ok(inserted), 201);
});

// ---------------------------------------------------------------------------
// Encrypted notes (§3.3)
//
// The Worker moves sealed blobs and never has a key. There is no search
// endpoint over notes and there cannot be one — searching ciphertext would
// mean holding plaintext somewhere, which is the thing being refused.
// ---------------------------------------------------------------------------

contacts.get('/:id/notes', async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT id, ciphertext, nonce, key_id, author_id, created_at
      FROM public.contact_notes
      WHERE contact_id = ${id}::uuid
      ORDER BY created_at DESC
    `,
  );

  return c.json(ok(rows));
});

contacts.post('/:id/notes', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  // .strict() — a body carrying a `plaintext` field is a bug worth failing on
  // loudly rather than quietly ignoring.
  const parsed = sealedNoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      err('A note must arrive already encrypted.', ERROR.VALIDATION, rid),
      400,
    );
  }
  const note = parsed.data;

  const sql = db(c);

  const inserted = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.contact_notes (tenant_id, contact_id, ciphertext, nonce, key_id, author_id)
      VALUES (
        coram.current_tenant_id(), ${id}::uuid, ${note.ciphertext},
        ${note.nonce}, ${note.keyId}::uuid, coram.current_user_id()
      )
      RETURNING id, created_at
    `;
    return row;
  });

  if (!inserted) return c.json(err(notVisible, ERROR.NOT_FOUND, rid), 404);
  return c.json(ok(inserted), 201);
});

contacts.delete('/:contactId/notes/:noteId', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  const removed = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`DELETE FROM public.contact_notes WHERE id = ${c.req.param('noteId')}::uuid RETURNING id`
      ).length,
  );

  if (!removed) return c.json(err('No such note.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok());
});

// ---------------------------------------------------------------------------

/**
 * Deliberately identical whether the contact does not exist or is simply
 * outside the caller's turf. Distinguishing them would let an organizer probe
 * for the existence of contacts they are not permitted to see.
 */
const notVisible = 'No such contact, or not one you can see.';

function contactWriteError(error: unknown, rid: string): [ReturnType<typeof err>, 400 | 403 | 409] {
  const code = (error as { code?: string })?.code;

  // 23505 unique_violation — the per-tenant email index (§5.1 deduplication).
  if (code === '23505') {
    return [err('Someone with that email is already in this workspace.', ERROR.CONFLICT, rid), 409];
  }
  // 23514 check_violation — either contacts_reachable or the tier ceiling.
  if (code === '23514') {
    return [err('Give at least a name, an email, or a phone number.', ERROR.VALIDATION, rid), 400];
  }
  // 42501 — the insert policy declined. Either the wrong turf, or the §6
  // contact ceiling, which within_contact_limit folds into the same predicate.
  if (code === '42501') {
    return [
      err(
        'Could not add that contact. Check the turf is one you hold, and that the workspace is under its contact limit.',
        ERROR.FORBIDDEN,
        rid,
      ),
      403,
    ];
  }

  return [err('Could not save that contact.', ERROR.INTERNAL, rid), 400];
}
