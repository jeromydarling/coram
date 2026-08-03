/**
 * /api/events/* — Convocare (§5.3).
 *
 * As with Membra, authorization is not decided here. `events_write` admits
 * stewards and organizers, `rsvps_select` follows the contact predicate, and a
 * handler that forgets something returns zero rows rather than the wrong ones.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { mintOneTimeToken, sha256Hex } from '../../lib/crypto';
import { ERROR, err, ok, logFailure } from '../../lib/http';
import { pgArray, withTenant } from '../../lib/rls';
import { db } from '../../lib/db';

import {
  adminRsvpSchema,
  createEventSchema,
  createShiftSchema,
  updateEventSchema,
} from '../../../shared/schemas/events';

export const events = new Hono<{ Bindings: Env; Variables: Vars }>();

events.use('*', requireWorkspace);

// ---------------------------------------------------------------------------
// GET /api/events
// ---------------------------------------------------------------------------

events.get('/', async (c) => {
  const session = c.get('session')!;
  const past = c.req.query('past') === 'true';

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT e.id, e.title, e.starts_at, e.ends_at, e.location_name,
             e.capacity, e.is_public, e.public_slug, e.cancelled_at,
             /*
              * coram.attendance rather than a subquery over rsvps.
              *
              * rsvps_select requires that you can see the underlying contact.
              * An observer can see none, so a plain count returned 0 for every
              * event — not denied, just silently false, in the direction that
              * makes a busy group look dead. §4.1 gives that role "read-only
              * aggregate reporting", and a headcount is the aggregate.
              *
              * The function returns a scalar and never a row, so an observer
              * learns forty-one are coming without learning who. See
              * migrations/0015_attendance_counts.sql.
              */
             coram.attendance(e.id, 'going') AS going,
             coram.attendance(e.id, 'waitlist') AS waitlisted
      FROM public.events e
      WHERE e.parent_event_id IS NULL
        AND ${past ? tx`e.starts_at < now()` : tx`e.starts_at >= now()`}
      ORDER BY e.starts_at ${past ? tx`DESC` : tx`ASC`}
      LIMIT 200
    `,
  );

  return c.json(ok(rows));
});

// ---------------------------------------------------------------------------
// POST /api/events
// ---------------------------------------------------------------------------

events.post('/', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = createEventSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  try {
    const created = await withTenant(sql, session, async (tx) => {
      const [row] = await tx`
        INSERT INTO public.events (
          tenant_id, title, description, starts_at, ends_at,
          location_name, location_address, capacity,
          is_public, public_slug, recurrence_rule,
          access_transit, access_step_free, access_asl, access_quiet_space, access_notes,
          created_by
        ) VALUES (
          coram.current_tenant_id(), ${input.title}, ${input.description ?? null},
          ${input.startsAt}::timestamptz, ${input.endsAt ?? null}::timestamptz,
          ${input.locationName ?? null}, ${input.locationAddress ?? null},
          ${input.capacity ?? null},
          ${input.isPublic}, ${input.isPublic ? slug(input.title) : null},
          ${input.recurrenceRule ?? null},
          ${input.accessTransit ?? null}, ${input.accessStepFree ?? null},
          ${input.accessAsl ?? null}, ${input.accessQuietSpace ?? null},
          ${input.accessNotes ?? null},
          coram.current_user_id()
        )
        RETURNING id, title, starts_at, is_public, public_slug
      `;
      return row;
    });

    return c.json(ok(created), 201);
  } catch (error) {
    logFailure('events', rid, error);
    return c.json(err('Could not create that event.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/events/:id
// ---------------------------------------------------------------------------

events.get('/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = db(c);

  const data = await withTenant(sql, session, async (tx) => {
    const [event] = await tx`SELECT * FROM public.events WHERE id = ${id}::uuid`;
    if (!event) return null;

    const shifts = await tx`
      SELECT s.id, s.name, s.starts_at, s.ends_at, s.slots,
             to_jsonb(s.required_skills) AS required_skills,
             (SELECT count(*) FROM public.shift_signups g WHERE g.shift_id = s.id)::int AS filled
      FROM public.event_shifts s WHERE s.event_id = ${id}::uuid ORDER BY s.starts_at
    `;

    // Joined to contacts so an organizer sees names — and note the join is what
    // applies the turf bound, since contacts carries the policy.
    const attendees = await tx`
      SELECT r.id, r.status, r.guest_count, r.needs_ride, r.can_offer_ride, r.ride_seats,
             r.childcare_children, r.access_needs, r.responded_at,
             c.id AS contact_id, c.display_name, c.email, c.postal_code,
             (ci.id IS NOT NULL) AS checked_in
      FROM public.rsvps r
      JOIN public.contacts c ON c.id = r.contact_id
      LEFT JOIN public.check_ins ci ON ci.event_id = r.event_id AND ci.contact_id = r.contact_id
      WHERE r.event_id = ${id}::uuid
      ORDER BY r.responded_at
    `;

    if (attendees.length) {
      await record(tx, { action: 'record.read', recordType: 'contact', recordCount: attendees.length });
    }

    return { event, shifts, attendees };
  });

  if (!data) return c.json(err('No such event.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok(data));
});

// ---------------------------------------------------------------------------
// PATCH /api/events/:id
// ---------------------------------------------------------------------------

events.patch('/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const parsed = updateEventSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  const updated = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      UPDATE public.events SET
        title            = coalesce(${input.title ?? null}, title),
        description      = coalesce(${input.description ?? null}, description),
        starts_at        = coalesce(${input.startsAt ?? null}::timestamptz, starts_at),
        ends_at          = coalesce(${input.endsAt ?? null}::timestamptz, ends_at),
        location_name    = coalesce(${input.locationName ?? null}, location_name),
        location_address = coalesce(${input.locationAddress ?? null}, location_address),
        capacity         = coalesce(${input.capacity ?? null}, capacity),
        access_transit     = coalesce(${input.accessTransit ?? null}, access_transit),
        access_step_free   = coalesce(${input.accessStepFree ?? null}, access_step_free),
        access_asl         = coalesce(${input.accessAsl ?? null}, access_asl),
        access_quiet_space = coalesce(${input.accessQuietSpace ?? null}, access_quiet_space),
        access_notes       = coalesce(${input.accessNotes ?? null}, access_notes)
      WHERE id = ${id}::uuid
      RETURNING id, title, starts_at, capacity
    `;
    return row;
  });

  if (!updated) return c.json(err('No such event.', ERROR.NOT_FOUND, rid), 404);

  // Raising the capacity should let waiting people in without anyone having to
  // remember to press a second button.
  if (input.capacity !== undefined) {
    await withTenant(sql, session, (tx) => tx`SELECT coram.promote_from_waitlist(${id}::uuid)`);
  }

  return c.json(ok(updated));
});

// ---------------------------------------------------------------------------
// POST /api/events/:id/cancel
//
// Cancelling, not deleting. People have it in their calendars and a deleted
// event page is a dead link with no explanation.
// ---------------------------------------------------------------------------

events.post('/:id/cancel', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = db(c);

  const cancelled = await withTenant(
    sql,
    session,
    async (tx) =>
      (
        await tx`
          UPDATE public.events SET cancelled_at = now()
          WHERE id = ${c.req.param('id')}::uuid AND cancelled_at IS NULL
          RETURNING id
        `
      ).length,
  );

  if (!cancelled) return c.json(err('No such event, or already cancelled.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok(undefined, { message: 'Cancelled. Tell the people who were coming.' }));
});

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

events.post('/:id/shifts', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const eventId = c.req.param('id');

  const parsed = createShiftSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = db(c);

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.event_shifts
        (tenant_id, event_id, name, starts_at, ends_at, slots, required_skills)
      VALUES (
        coram.current_tenant_id(), ${eventId}::uuid, ${input.name},
        ${input.startsAt}::timestamptz, ${input.endsAt}::timestamptz,
        ${input.slots},
        -- See lib/rls.ts: a JS array cannot be bound to a text[] column here.
        ${pgArray(input.requiredSkills ?? [])}::text[]
      )
      RETURNING id, name, starts_at, ends_at, slots
    `;
    return row;
  });

  return c.json(ok(created), 201);
});

events.post('/shifts/:shiftId/signup', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const shiftId = c.req.param('shiftId');

  const body = (await c.req.json().catch(() => null)) as { contactId?: string } | null;
  const contactId = body?.contactId;
  if (!contactId) {
    return c.json(err('Which contact is taking the shift?', ERROR.VALIDATION, rid), 400);
  }

  const sql = db(c);

  try {
    const result = await withTenant(sql, session, async (tx) => {
      // Capacity checked inside the transaction so two organizers filling the
      // last slot at once cannot both succeed.
      const [shift] = await tx`
        SELECT s.slots,
               (SELECT count(*) FROM public.shift_signups g WHERE g.shift_id = s.id)::int AS filled
        FROM public.event_shifts s WHERE s.id = ${shiftId}::uuid
      `;
      if (!shift) return 'not_found' as const;
      if (Number(shift.filled) >= Number(shift.slots)) return 'full' as const;

      await tx`
        INSERT INTO public.shift_signups (tenant_id, shift_id, contact_id)
        VALUES (coram.current_tenant_id(), ${shiftId}::uuid, ${contactId}::uuid)
        ON CONFLICT (shift_id, contact_id) DO NOTHING
      `;
      return 'ok' as const;
    });

    if (result === 'not_found') return c.json(err('No such shift.', ERROR.NOT_FOUND, rid), 404);
    if (result === 'full') return c.json(err('That shift is full.', ERROR.CONFLICT, rid), 409);
    return c.json(ok());
  } catch (error) {
    logFailure('events', rid, error);
    return c.json(err('Could not sign that contact up.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// RSVPs recorded by an organizer
// ---------------------------------------------------------------------------

events.post('/:id/rsvps', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const eventId = c.req.param('id');

  const parsed = adminRsvpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  // The QR token is generated here and returned once. We keep only the hash,
  // so if the organizer loses it a new one must be issued — the same trade as
  // password reset tokens in 0001.
  const { token, hash } = await mintOneTimeToken();

  const sql = db(c);

  const created = await withTenant(sql, session, async (tx) => {
    const [row] = await tx`
      INSERT INTO public.rsvps (
        tenant_id, event_id, contact_id, status, guest_count,
        needs_ride, can_offer_ride, ride_seats, childcare_children,
        access_needs, checkin_token_hash
      ) VALUES (
        coram.current_tenant_id(), ${eventId}::uuid, ${input.contactId}::uuid,
        ${input.status}, ${input.guestCount},
        ${input.needsRide}, ${input.canOfferRide}, ${input.rideSeats},
        ${input.childcareChildren}, ${input.accessNeeds ?? null}, ${hash}
      )
      ON CONFLICT (event_id, contact_id) DO UPDATE
        SET status = excluded.status, guest_count = excluded.guest_count,
            needs_ride = excluded.needs_ride, can_offer_ride = excluded.can_offer_ride,
            ride_seats = excluded.ride_seats,
            childcare_children = excluded.childcare_children,
            access_needs = excluded.access_needs, responded_at = now()
      RETURNING id, status
    `;
    return row;
  });

  if (!created) return c.json(err('No such contact, or not one you can see.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok({ ...created, checkinToken: token }), 201);
});

events.delete('/:id/rsvps/:rsvpId', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const eventId = c.req.param('id');

  const sql = db(c);

  const removed = await withTenant(sql, session, async (tx) => {
    const rows = await tx`DELETE FROM public.rsvps WHERE id = ${c.req.param('rsvpId')}::uuid RETURNING id`;
    // Someone dropping out should let the next person in immediately.
    if (rows.length) await tx`SELECT coram.promote_from_waitlist(${eventId}::uuid)`;
    return rows.length;
  });

  if (!removed) return c.json(err('No such RSVP.', ERROR.NOT_FOUND, rid), 404);
  return c.json(ok());
});

// ---------------------------------------------------------------------------
// POST /api/events/check-in — §5.3, boolean only
// ---------------------------------------------------------------------------

events.post('/check-in', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const body = (await c.req.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return c.json(err('No code was scanned.', ERROR.VALIDATION, rid), 400);

  const sql = db(c);

  try {
    const [result] = await withTenant(
      sql,
      session,
      async (tx) => tx`SELECT * FROM coram.check_in_by_token(${await sha256Hex(body.token!)})`,
    );

    return c.json(
      ok({
        eventTitle: result.event_title,
        alreadyCheckedIn: result.already_checked_in,
      }),
    );
  } catch (error) {
    if ((error as { code?: string })?.code === 'P0002') {
      return c.json(err('That code is not valid for any booking.', ERROR.NOT_FOUND, rid), 404);
    }
    return c.json(err('Could not check that person in.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/events/:id/no-shows — §5.3 no-show follow-up
//
// Returns the segment; sending to it is Nuntius's job (§5.4). Keeping the two
// apart means follow-up goes through the opt-out ledger like every other send,
// with no "but this one is operational" exemption.
// ---------------------------------------------------------------------------

events.get('/:id/no-shows', async (c) => {
  const session = c.get('session')!;

  const sql = db(c);

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT c.id, c.display_name, c.email, c.phone
      FROM public.rsvps r
      JOIN public.contacts c ON c.id = r.contact_id
      LEFT JOIN public.check_ins ci
        ON ci.event_id = r.event_id AND ci.contact_id = r.contact_id
      WHERE r.event_id = ${c.req.param('id')}::uuid
        AND r.status = 'going'
        AND ci.id IS NULL
      ORDER BY c.display_name
    `,
  );

  return c.json(ok(rows));
});

// ---------------------------------------------------------------------------
// GET /api/events/:id/carpool — §5.3 carpool matching
//
// Matched on the postal code already held on the contact. There is no pickup
// address anywhere in this product (§3.1); an organizer with a plausible pair
// can ask the two people directly, which is how lifts actually get arranged.
// ---------------------------------------------------------------------------

events.get('/:id/carpool', async (c) => {
  const session = c.get('session')!;
  const eventId = c.req.param('id');

  const sql = db(c);

  const { drivers, riders } = await withTenant(sql, session, async (tx) => {
    const rows = await tx`
      SELECT r.needs_ride, r.can_offer_ride, r.ride_seats,
             c.id, c.display_name, c.postal_code
      FROM public.rsvps r
      JOIN public.contacts c ON c.id = r.contact_id
      WHERE r.event_id = ${eventId}::uuid
        AND r.status IN ('going', 'waitlist')
        AND (r.needs_ride OR r.can_offer_ride)
    `;
    return {
      drivers: rows.filter((r) => r.can_offer_ride),
      riders: rows.filter((r) => r.needs_ride),
    };
  });

  // Coarse: share the first three characters of a postal code. Enough to say
  // "these two are near each other", not enough to place anyone.
  const area = (postal: unknown) => String(postal ?? '').replace(/\s/g, '').slice(0, 3).toUpperCase();

  const suggestions = riders.map((rider) => ({
    rider: { id: rider.id, displayName: rider.display_name },
    nearby: drivers
      .filter((d) => area(d.postal_code) && area(d.postal_code) === area(rider.postal_code))
      .map((d) => ({ id: d.id, displayName: d.display_name, seats: d.ride_seats })),
  }));

  return c.json(
    ok({
      suggestions,
      unmatched: suggestions.filter((s) => !s.nearby.length).length,
      driversWithoutPostalCode: drivers.filter((d) => !area(d.postal_code)).length,
    }),
  );
});

/** Lowercase, hyphenated, with a short random suffix so titles can repeat. */
function slug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'event'}-${crypto.randomUUID().slice(0, 6)}`;
}
