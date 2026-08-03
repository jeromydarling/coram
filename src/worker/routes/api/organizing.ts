/**
 * /api/organizing/* — the tools that turn a list into a day's work.
 *
 * Two things live here, and they are together because neither is a module:
 * they are the paper and the front door a group needs around the eleven.
 *
 *   GET/PUT /page   the workspace's own public page at /g/<slug>
 *   GET     /sheet  a printable list for a turf
 *
 * ---------------------------------------------------------------------------
 * There is no walk list here, and that is not an omission
 * ---------------------------------------------------------------------------
 *
 * A walk list in the canvassing sense is addresses in door order, and Coram
 * does not hold a street address. 0002_membra.sql stores `postal_code` as the
 * finest location there is and says §3.7 forbids anything finer permanently —
 * so a door-order list cannot be produced from this database, and producing one
 * would mean first abandoning the commitment the whole product is built on.
 *
 * That is the right trade and it is worth stating plainly rather than hiding
 * behind an absence: the addresses a canvasser walks come from a voter file the
 * group licenses, or from the building they live in, and both of those stay
 * with the group. What Coram can put on paper is its own half — who is on the
 * list, what was last said to them, and what somebody owes them — with a column
 * to write in and a line at the top about what to do if the sheet is lost.
 *
 * ---------------------------------------------------------------------------
 * The sheet is an export, and it is audited like one
 * ---------------------------------------------------------------------------
 *
 * Printing forty names and phone numbers is bulk access to contact data. §3
 * says that is logged, so it is — and the phone column is opt-in rather than
 * default, because a sheet left in a car is the most ordinary data loss in
 * organizing and a sheet without numbers on it loses much less.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { db } from '../../lib/db';
import { ERROR, detailFor, err, logFailure, ok } from '../../lib/http';
import { withTenant } from '../../lib/rls';

export const organizing = new Hono<{ Bindings: Env; Variables: Vars }>();

organizing.use('*', requireWorkspace);

// ---------------------------------------------------------------------------
// The public page
// ---------------------------------------------------------------------------

const pageSchema = z.object({
  published: z.boolean(),
  tagline: z.string().trim().max(160).nullable().optional(),
  about: z.string().trim().max(4_000).nullable().optional(),
  contact: z.string().trim().max(300).nullable().optional(),
  getInvolved: z.string().trim().max(600).nullable().optional(),
});

organizing.get('/page', async (c) => {
  const rid = c.get('requestId');
  try {
    const data = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [tenant] = await tx<{ slug: string; name: string }[]>`
        SELECT slug, name FROM public.tenants WHERE id = coram.current_tenant_id()
      `;
      const [page] = await tx`
        SELECT published, tagline, about, contact, get_involved, updated_at
        FROM public.public_pages
      `;
      // Count what would appear, so a steward can see before publishing that
      // turning this on does not by itself publish anything about a meeting.
      const [{ count }] = await tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.events
        WHERE is_public AND public_slug IS NOT NULL AND cancelled_at IS NULL AND starts_at > now()
      `;
      return { slug: tenant?.slug, name: tenant?.name, page: page ?? null, publicEvents: count };
    });
    return c.json(ok(data));
  } catch (error) {
    logFailure('organizing.page.get', rid, error);
    return c.json(err('Could not load your page.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

organizing.put('/page', async (c) => {
  const rid = c.get('requestId');
  const parsed = pageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  /*
   * Refuse to publish an empty page.
   *
   * A page with a name and nothing else tells a stranger that a political group
   * exists and gives them no reason it was worth telling them — which is the
   * disclosure without any of the benefit. RLS already limits this to stewards;
   * this is about not letting a well-meaning one publish a stub.
   */
  if (input.published && !input.about?.trim() && !input.getInvolved?.trim()) {
    return c.json(
      err(
        'Write something first. A page carrying only your name tells a stranger that your group ' +
          'exists and gives them no reason that was worth telling them.',
        ERROR.VALIDATION,
        rid,
      ),
      400,
    );
  }

  try {
    const saved = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [row] = await tx`
        INSERT INTO public.public_pages
          (tenant_id, published, tagline, about, contact, get_involved)
        VALUES (
          coram.current_tenant_id(), ${input.published}, ${input.tagline ?? null},
          ${input.about ?? null}, ${input.contact ?? null}, ${input.getInvolved ?? null}
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          published    = EXCLUDED.published,
          tagline      = EXCLUDED.tagline,
          about        = EXCLUDED.about,
          contact      = EXCLUDED.contact,
          get_involved = EXCLUDED.get_involved
        RETURNING published, tagline, about, contact, get_involved
      `;

      /*
       * Audited, and it is the only text-only table in the product that is.
       *
       * Not because it holds personal data — it holds none — but because
       * publishing is the one action here that makes something visible outside
       * the room, and "who turned this on, and when" is the question a group
       * will actually ask if a page appears that somebody did not expect.
       */
      await record(tx, {
        action: input.published ? 'page.publish' : 'page.unpublish',
        recordType: 'public_page',
      });

      return row;
    });
    return c.json(ok(saved));
  } catch (error) {
    logFailure('organizing.page.put', rid, error);
    return c.json(err('Could not save your page.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// The turf sheet
// ---------------------------------------------------------------------------

organizing.get('/sheet', async (c) => {
  const rid = c.get('requestId');
  const turf = c.req.query('turf');
  const withPhones = c.req.query('phones') === '1';

  if (!turf || !/^[0-9a-f-]{36}$/i.test(turf)) {
    return c.json(err('Pick a turf.', ERROR.VALIDATION, rid), 400);
  }

  try {
    const data = await withTenant(db(c), c.get('session')!, async (tx) => {
      const [t] = await tx<{ name: string }[]>`
        SELECT name FROM public.turfs WHERE id = ${turf}::uuid
      `;
      if (!t) return null;

      /*
       * RLS does the scoping, not a WHERE clause on the caller's turfs.
       *
       * `contacts_select` already limits an organizer to their own turfs, so an
       * organizer asking for somebody else's turf gets an empty sheet rather
       * than a refusal — and the constraint is structural rather than
       * remembered here. Same reasoning as the export route.
       */
      const rows = await tx`
        SELECT c.display_name, c.postal_code, c.last_interaction_at,
               ${withPhones ? tx`c.phone` : tx`NULL::text AS phone`},
               -- The oldest thing still owed to this person, so the sheet
               -- says why their name is on it rather than only that it is.
               (
                 SELECT f.due_at FROM public.follow_ups f
                 WHERE f.contact_id = c.id AND f.status = 'open'
                 ORDER BY f.due_at LIMIT 1
               ) AS due_at,
               (
                 SELECT f.reason FROM public.follow_ups f
                 WHERE f.contact_id = c.id AND f.status = 'open'
                 ORDER BY f.due_at LIMIT 1
               ) AS owed
        FROM public.contacts c
        WHERE c.turf_id = ${turf}::uuid
        ORDER BY c.display_name
        LIMIT 400
      `;

      if (rows.length) {
        await record(tx, {
          action: withPhones ? 'sheet.print_with_phones' : 'sheet.print',
          recordType: 'contact',
          recordCount: rows.length,
        });
      }

      return { turf: t.name, rows };
    });

    if (!data) return c.json(err('No such turf.', ERROR.NOT_FOUND, rid), 404);
    return c.json(ok(data.rows, { turf: data.turf, withPhones }));
  } catch (error) {
    logFailure('organizing.sheet', rid, error);
    return c.json(err('Could not build that sheet.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});
