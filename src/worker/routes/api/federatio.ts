/**
 * /api/federatio/* — the coalition layer (§5.11).
 *
 * The default is roll-up counts. Everything narrower requires a grant the
 * chapter made and can destroy, and there is no route here that returns a
 * chapter's individual records to a parent — see the note at the end of
 * migrations/0010_federatio.sql for why that is a deliberate absence rather
 * than an unfinished feature.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { requireWorkspace } from '../../lib/auth';
import { ERROR, err, ok, logFailure } from '../../lib/http';
import {withTenant} from '../../lib/rls';
import { db } from '../../lib/db';


export const federatio = new Hono<{ Bindings: Env; Variables: Vars }>();

federatio.use('*', requireWorkspace);

const grantSchema = z.object({
  federationId: z.string().uuid(),
  scope: z.enum(['contacts', 'events', 'funds']),
  segmentId: z.string().uuid().optional(),
  /**
   * Optional, and the UI defaults it to twelve months out. A grant with no
   * expiry is a grant nobody ever revisits.
   */
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/federatio/chapters — what a parent sees by default
// ---------------------------------------------------------------------------

federatio.get('/chapters', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  try {
    const rows = await withTenant(sql, session, (tx) => tx`SELECT * FROM coram.chapter_rollup()`);

    return c.json(
      ok(rows, {
        // Said on every response, because a coalition that assumes it can see
        // more will build a process around data it does not have.
        subsidiarity:
          'Counts only. Reaching individual records in a chapter needs that chapter to ' +
          'grant it, and they can revoke it at any time.',
      }),
    );
  } catch (error) {
    logFailure('federatio', rid, error);
    return c.json(err('This workspace is not a coalition parent.', ERROR.FORBIDDEN, rid), 403);
  }
});

// ---------------------------------------------------------------------------
// Grants — the chapter's side
// ---------------------------------------------------------------------------

federatio.get('/grants', async (c) => {
  const session = c.get('session')!;

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT g.id, g.federation_id, g.chapter_tenant_id, g.scope, g.segment_id,
             g.granted_at, g.expires_at, g.revoked_at,
             f.name AS federation_name,
             (g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())) AS active
      FROM public.federation_grants g
      JOIN public.federations f ON f.id = g.federation_id
      ORDER BY g.granted_at DESC
    `,
  );

  return c.json(ok(rows));
});

federatio.post('/grants', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = grantSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  // The policy admits only the chapter's own steward, so a parent attempting
  // this writes zero rows. The 403 below is the explanation, not the decision.
  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.federation_grants
        (federation_id, chapter_tenant_id, scope, segment_id, granted_by, expires_at)
      VALUES (
        ${input.federationId}::uuid, coram.current_tenant_id(), ${input.scope},
        ${input.segmentId ?? null}::uuid,
        (SELECT m.id FROM public.memberships m
         WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id()),
        ${input.expiresAt ?? null}::timestamptz
      )
      RETURNING id, scope, granted_at, expires_at
    `;
    return row;
  });

  if (!created) {
    return c.json(
      err(
        'Only a chapter steward can grant access to that chapter, and only for their own workspace.',
        ERROR.FORBIDDEN,
        rid,
      ),
      403,
    );
  }

  return c.json(
    ok(created, {
      message: input.expiresAt
        ? 'Granted. You can revoke this at any time.'
        : 'Granted with no expiry. Consider setting one — a grant nobody revisits is one nobody reviews.',
    }),
    201,
  );
});

federatio.delete('/grants/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  // Revoked, not deleted. The row is the evidence that a chapter once shared
  // something and then stopped, and destroying it would erase the record of an
  // access that actually happened.
  const revoked = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`
          UPDATE public.federation_grants SET revoked_at = now()
          WHERE id = ${c.req.param('id')}::uuid AND revoked_at IS NULL
          RETURNING id
        `
      ).length,
  );

  if (!revoked) return c.json(err('No such active grant.', ERROR.NOT_FOUND, rid), 404);

  return c.json(
    ok(undefined, {
      message: 'Revoked. The coalition can no longer see those records. Roll-up counts continue.',
    }),
  );
});

// ---------------------------------------------------------------------------
// Chapters accepting and leaving
// ---------------------------------------------------------------------------

federatio.post('/invitations/:id/accept', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  const accepted = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`
          UPDATE public.federation_chapters SET accepted_at = now()
          WHERE id = ${c.req.param('id')}::uuid AND accepted_at IS NULL AND left_at IS NULL
          RETURNING id
        `
      ).length,
  );

  if (!accepted) return c.json(err('No such open invitation.', ERROR.NOT_FOUND, rid), 404);

  return c.json(
    ok(undefined, {
      message:
        'Joined. The coalition can see your totals. It cannot see any individual record ' +
        'until you grant it separately.',
    }),
  );
});

federatio.post('/chapters/leave', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  const left = await withTenant(sql, session, async (tx) => {
    const rows = await tx`
      UPDATE public.federation_chapters SET left_at = now()
      WHERE chapter_tenant_id = coram.current_tenant_id() AND left_at IS NULL
      RETURNING id
    `;

    // Leaving revokes everything. A chapter that walks out of a coalition and
    // leaves a live grant behind has not actually left.
    if (rows.length) {
      await tx`
        UPDATE public.federation_grants SET revoked_at = now()
        WHERE chapter_tenant_id = coram.current_tenant_id() AND revoked_at IS NULL
      `;
    }
    return rows.length;
  });

  if (!left) return c.json(err('This workspace is not in a coalition.', ERROR.NOT_FOUND, rid), 404);

  return c.json(
    ok(undefined, { message: 'Left the coalition. Every grant you had made is revoked.' }),
  );
});
