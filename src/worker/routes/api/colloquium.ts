/**
 * /api/colloquium/* — secure internal comms (§5.7).
 *
 * The schema (0008) and the delivery object (ChannelDO) were both finished and
 * nothing routed between them, so the module existed everywhere except where a
 * person could reach it. This is that route, and it is deliberately thin: it
 * decides *who* may speak in a room and records *that* they did. It never sees
 * what was said.
 *
 * The split is the whole design:
 *
 *   Postgres gets the envelope — channel, sender, a coarsened byte length, a
 *   time. A subpoena served on it returns who spoke in which room and roughly
 *   how much. That is the floor; you cannot deliver a message without knowing
 *   where to send it.
 *
 *   ChannelDO gets the sealed blob and holds it for the channel's TTL, capped
 *   at thirty days by a CHECK constraint rather than by a settings screen
 *   somebody can argue with.
 *
 * Note the absent steward override. Paying for the workspace lets you see that
 * a channel exists and lets you delete it. It does not put you in the room.
 * That is enforced by channels_select in 0008, not by this file — but this file
 * must not invent a way around it, so every read here goes through the caller's
 * own RLS and there is no service-role path.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { requireWorkspace } from '../../lib/auth';
import { ERROR, err, ok, logFailure } from '../../lib/http';
import { withTenant } from '../../lib/rls';
import { db } from '../../lib/db';

export const colloquium = new Hono<{ Bindings: Env; Variables: Vars }>();

colloquium.use('*', requireWorkspace);

const createChannelSchema = z.object({
  name: z.string().trim().min(1, 'Name the channel.').max(80),
  /** Capped at 30 here, in the CHECK, and again inside the DO. Three places on purpose. */
  ttlDays: z.number().int().min(1).max(30).default(30),
});

/**
 * What the browser sends. There is no `body` field and there never will be —
 * `.strict()` so a well-meaning future change that adds one fails loudly
 * instead of quietly persisting plaintext.
 */
const sendSchema = z
  .object({
    ciphertext: z.string().min(1).max(128_000),
    nonce: z.string().min(1).max(64),
  })
  .strict();

// ---------------------------------------------------------------------------
// GET /api/colloquium/channels
// ---------------------------------------------------------------------------

colloquium.get('/channels', async (c) => {
  const session = c.get('session')!;
  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT ch.id, ch.name, ch.kind, ch.ttl_days, ch.created_at, ch.archived_at,
             coram.in_channel(ch.id) AS joined,
             (SELECT count(*) FROM public.channel_members m WHERE m.channel_id = ch.id)::int
               AS members,
             (SELECT max(e.sent_at) FROM public.message_envelopes e WHERE e.channel_id = ch.id)
               AS last_message_at
      FROM public.channels ch
      WHERE ch.archived_at IS NULL
      ORDER BY ch.name
    `,
  );

  return c.json(
    ok(rows, {
      // Said on every response because it is the surprising part, and a person
      // deciding what to type in here deserves to know before they type it.
      retention:
        'We keep who spoke in which room, roughly how much, and when. We do not keep what was ' +
        'said — the sealed text is deleted when the channel TTL runs out, and we never held a key.',
    }),
  );
});

// ---------------------------------------------------------------------------
// POST /api/colloquium/channels
// ---------------------------------------------------------------------------

colloquium.post('/channels', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = createChannelSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const { name, ttlDays } = parsed.data;

  const sql = db(c);

  try {
    const created = await withTenant(sql, session, async (tx) => {
      const [row] = await tx`
        INSERT INTO public.channels (tenant_id, name, kind, ttl_days, created_by)
        VALUES (
          coram.current_tenant_id(), ${name}, 'channel', ${ttlDays},
          (SELECT m.id FROM public.memberships m
           WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id())
        )
        RETURNING id, name, ttl_days
      `;
      if (!row) return null;

      // The creator joins their own channel. Without this the row exists and
      // channels_select's in_channel() branch is false, so they would create a
      // room they cannot enter — visible to a steward and to nobody else.
      await tx`
        INSERT INTO public.channel_members (channel_id, membership_id, tenant_id)
        VALUES (
          ${row.id}::uuid,
          (SELECT m.id FROM public.memberships m
           WHERE m.user_id = coram.current_user_id() AND m.tenant_id = coram.current_tenant_id()),
          coram.current_tenant_id()
        )
      `;
      return row;
    });

    if (!created) {
      return c.json(err('Observers and legal accounts cannot open channels.', ERROR.FORBIDDEN, rid), 403);
    }

    // Tell the object its TTL now, so the first message expires correctly even
    // if nothing ever calls configure again.
    await channel(c.env, created.id as string).fetch(
      new Request('https://do/configure', {
        method: 'POST',
        body: JSON.stringify({ ttlDays: created.ttl_days }),
      }),
    );

    return c.json(ok(created), 201);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === '42501') {
      return c.json(err('Your role cannot open channels.', ERROR.FORBIDDEN, rid), 403);
    }
    logFailure('colloquium.channels.create', rid, error);
    return c.json(err('Could not open that channel.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/colloquium/channels/:id/join
// ---------------------------------------------------------------------------

colloquium.post('/channels/:id/join', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  /*
   * channel_members_write requires in_channel() — you may add people to a room
   * you are in. Joining an open channel yourself is therefore not an INSERT the
   * caller can make, and widening the policy to allow it would also let anyone
   * add themselves to a DM. So this runs through a SECURITY DEFINER function
   * that admits named channels only and never DMs.
   */
  try {
    const joined = await withTenant(
      sql,
      session,
      async (tx) => (await tx`SELECT coram.join_channel(${id}::uuid) AS ok`)[0]?.ok,
    );

    if (!joined) return c.json(err('No such open channel.', ERROR.NOT_FOUND, rid), 404);
    return c.json(ok());
  } catch (error) {
    logFailure('colloquium.channels.join', rid, error);
    return c.json(err('Could not join that channel.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/colloquium/channels/:id/messages
// ---------------------------------------------------------------------------

colloquium.get('/channels/:id/messages', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');
  const after = Number(c.req.query('after') ?? 0);

  const sql = db(c);

  // Authorization first, and in Postgres. If the caller is not in the room this
  // returns nothing, and the Durable Object is never asked — the DO has no
  // notion of tenancy and must never be reachable without this check.
  const allowed = await withTenant(
    sql,
    session,
    async (tx) =>
      (await tx`SELECT coram.in_channel(${id}::uuid) AS ok`)[0]?.ok === true,
  );

  if (!allowed) {
    return c.json(err('You are not in that channel.', ERROR.FORBIDDEN, rid), 403);
  }

  const res = await channel(c.env, id).fetch(
    new Request('https://do/since', { method: 'POST', body: JSON.stringify({ after }) }),
  );
  const body = (await res.json()) as {
    messages: { id: string; ciphertext: string; nonce: string; senderId: string; sentAt: number }[];
    cursor: number;
  };

  return c.json(ok(body));
});

// ---------------------------------------------------------------------------
// POST /api/colloquium/channels/:id/messages
// ---------------------------------------------------------------------------

colloquium.post('/channels/:id/messages', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const parsed = sendSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      err('A message has to be sealed before it is sent.', ERROR.VALIDATION, rid),
      400,
    );
  }
  const { ciphertext, nonce } = parsed.data;

  const sql = db(c);

  try {
    /*
     * The envelope is written first, and it is what authorizes the send.
     *
     * record_envelope is SECURITY DEFINER and checks membership itself; if the
     * caller is not in the room it raises rather than returning a row. Writing
     * it before the ciphertext leaves means a message can never exist in the DO
     * without a corresponding envelope — the reverse order would let a failed
     * insert strand ciphertext nobody can account for.
     */
    const [envelope] = await withTenant(
      sql,
      session,
      (tx) => tx`
        SELECT * FROM coram.record_envelope(${id}::uuid, ${ciphertext.length})
      `,
    );

    if (!envelope) return c.json(err('You are not in that channel.', ERROR.FORBIDDEN, rid), 403);

    await channel(c.env, id).fetch(
      new Request('https://do/send', {
        method: 'POST',
        body: JSON.stringify({
          id: envelope.envelope_id,
          ciphertext,
          nonce,
          senderId: session.userId,
        }),
      }),
    );

    return c.json(ok({ id: envelope.envelope_id, expiresAt: envelope.expires_at }), 201);
  } catch (error) {
    const detail = String((error as { message?: string })?.message ?? '');
    if (detail.includes('not a member')) {
      return c.json(err('You are not in that channel.', ERROR.FORBIDDEN, rid), 403);
    }
    logFailure('colloquium.messages.send', rid, error);
    return c.json(err('Could not send that.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/colloquium/channels/:id — a steward closes a room
// ---------------------------------------------------------------------------

colloquium.delete('/channels/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const deleted = await withTenant(
    sql,
    session,
    async (tx) =>
      (await tx`DELETE FROM public.channels WHERE id = ${id}::uuid RETURNING id`).length,
  );

  if (!deleted) {
    return c.json(err('No such channel, or you are not a steward.', ERROR.NOT_FOUND, rid), 404);
  }

  // Blobs go immediately rather than waiting out the TTL. A room somebody
  // deleted should not still be readable by anyone holding a key to it.
  await channel(c.env, id).fetch(new Request('https://do/purge', { method: 'POST' }));

  return c.json(
    ok(undefined, {
      message: 'Channel deleted and every sealed message in it destroyed. The envelopes remain until their own expiry.',
    }),
  );
});

/** One object per channel, named by the channel's id. */
function channel(env: Env, id: string) {
  return env.DO_CHANNEL.get(env.DO_CHANNEL.idFromName(id));
}
