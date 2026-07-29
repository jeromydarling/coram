/**
 * /api/petitio/* — advocacy (§5.5), and the bill a group writes.
 *
 * §5.5's spec line is "legislator lookup by address, federal through municipal"
 * and "delivery and response tracking". A bill-drafting tool is what that
 * becomes once a petition has succeeded and the group wants the thing itself, so
 * this is the eleventh module rather than a twelfth.
 *
 * ---------------------------------------------------------------------------
 * Nothing here is gated.
 * ---------------------------------------------------------------------------
 *
 * The brief this was built from recommends locking the outreach tracker and
 * sponsor matching behind a completed, well-formed draft, on the theory that
 * finishing the hard work should unlock the interesting tools. That is exactly
 * backwards for this product. The group most likely to already have a
 * legislator's ear is the experienced one, and telling them to finish their
 * homework before they may log a meeting they have already had is the kind of
 * condescension that sends people back to a spreadsheet.
 *
 * So `reviewDraft` advises and never forbids, and every route is reachable at
 * any stage. What earns the draft's completion is that the completed draft is
 * useful, not that the product withheld something until then.
 *
 * ---------------------------------------------------------------------------
 * And nothing here writes to the audit log.
 * ---------------------------------------------------------------------------
 *
 * That is not an omission. The audit log exists to record access to personal
 * data (§3) — who read which contact, who exported what. A bill is the group's
 * own political position and holds no personal data at all, so logging every
 * edit to it would add a trail of who-wrote-which-clause without protecting
 * anybody. In a product built for people who may be subpoenaed, an audit row
 * that serves no privacy purpose is a liability rather than a control.
 *
 * The one table here that does name a person, bill_outreach, is covered by
 * retention instead: two years, then gone.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { requireWorkspace } from '../../lib/auth';
import { db } from '../../lib/db';
import { ERROR, detailFor, err, logFailure, ok } from '../../lib/http';
import { withTenant, type Tx } from '../../lib/rls';
import {
  SCAFFOLD,
  isReady,
  renderBill,
  reviewDraft,
  scaffoldFor,
  type BillDraft,
  type Section,
  type SectionKind,
} from '../../lib/bill';
import { sponsorOptions } from '../../lib/sponsors';
import { PATHWAYS, pathwayFor, routesFor, signatureTarget } from '../../../shared/legislative';

export const petitio = new Hono<{ Bindings: Env; Variables: Vars }>();

petitio.use('*', requireWorkspace);

const JURISDICTIONS = new Set(PATHWAYS.map((p) => p.code));

const jurisdiction = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => JURISDICTIONS.has(v), 'Pick one of the fifty states or DC.');

const ROUTE_KINDS = ['local', 'initiative', 'indirect-initiative', 'referendum', 'sponsor'] as const;

const SECTION_KINDS = [
  'short_title',
  'enacting_clause',
  'findings',
  'definitions',
  'operative',
  'severability',
  'effective_date',
] as const;

const createSchema = z.object({
  workingName: z.string().trim().min(1, 'Give it a working name.').max(160),
  jurisdiction,
  locality: z.string().trim().max(120).optional(),
  route: z.enum(ROUTE_KINDS),
  problem: z.string().trim().max(8_000).optional(),
  intent: z.string().trim().max(4_000).optional(),
});

const STAGES = [
  'drafting',
  'adopted',
  'seeking_sponsor',
  'filed',
  'in_committee',
  'passed',
  'failed',
  'withdrawn',
] as const;

const updateSchema = z.object({
  workingName: z.string().trim().min(1).max(160).optional(),
  locality: z.string().trim().max(120).nullable().optional(),
  problem: z.string().trim().max(8_000).nullable().optional(),
  intent: z.string().trim().max(4_000).nullable().optional(),
  stage: z.enum(STAGES).optional(),
  /** Only meaningful once a legislator has actually filed it. */
  filedAs: z.string().trim().max(40).nullable().optional(),
});

const sectionSchema = z.object({
  kind: z.enum(SECTION_KINDS),
  position: z.number().int().min(0).max(200).default(0),
  heading: z.string().trim().max(160).nullable().optional(),
  body: z.string().max(40_000).default(''),
});

// ---------------------------------------------------------------------------
// The field guide. Read-only, no tenant data, so it answers before any query.
// ---------------------------------------------------------------------------

/**
 * What a group in this jurisdiction can actually do.
 *
 * Served from the compiled research rather than the database: it is published
 * reference data, the same for every workspace, and putting it in Postgres would
 * mean a tenant could in principle hold a different set of facts about their own
 * state than we published.
 */
petitio.get('/pathways/:code', (c) => {
  const code = c.req.param('code');
  const pathway = pathwayFor(code);
  if (!pathway) {
    return c.json(err('No field guide for that jurisdiction.', ERROR.NOT_FOUND, c.get('requestId')), 404);
  }

  return c.json(
    ok({
      pathway,
      routes: routesFor(code),
      signatures: signatureTarget(code),
      scaffold: SCAFFOLD,
    }),
  );
});

/** Every jurisdiction, in brief, for a picker. */
petitio.get('/pathways', (c) =>
  c.json(
    ok(
      PATHWAYS.map((p) => ({
        code: p.code,
        name: p.name,
        statute: p.statute,
        constitutional: p.constitutional,
        referendum: p.referendum,
        localInitiative: p.localInitiative,
      })),
      {
        // Stated on the payload rather than left to the UI. The research is
        // dated and several of these numbers move on election night.
        notice:
          'Researched July 2026. Signature thresholds are recomputed after each qualifying ' +
          'election — check the state’s own figure before you gather anything.',
      },
    ),
  ),
);

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

petitio.get('/bills', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  try {
    const rows = await withTenant(db(c), session, (tx) => tx`
      SELECT b.id, b.working_name, b.jurisdiction, b.locality, b.route, b.stage,
             b.filed_as, b.filed_at, b.created_at, b.updated_at,
             (SELECT count(*) FROM public.bill_sections s WHERE s.bill_id = b.id)::int AS sections,
             (SELECT count(*) FROM public.bill_endorsements e WHERE e.bill_id = b.id)::int AS endorsements
      FROM public.bills b
      ORDER BY b.updated_at DESC
      LIMIT 200
    `);
    return c.json(ok(rows));
  } catch (error) {
    logFailure('petitio.bills.list', rid, error);
    return c.json(err('Could not load your bills.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

petitio.post('/bills', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  /*
   * Refuse a route the jurisdiction does not have, at creation.
   *
   * This is the one place the field guide is enforced rather than advisory, and
   * it is worth it: 29 jurisdictions have no citizen statutory initiative, and a
   * group that starts a draft labelled "ballot initiative" in Texas has been
   * told by the product that a year of work is possible when it is not.
   */
  const available = new Set(routesFor(input.jurisdiction).map((r) => r.kind));
  if (!available.has(input.route)) {
    const pathway = pathwayFor(input.jurisdiction)!;
    return c.json(
      err(
        `${pathway.name} does not have that route. What it has: ` +
          `${[...available].join(', ')}.`,
        ERROR.VALIDATION,
        rid,
      ),
      400,
    );
  }

  try {
    const created = await withTenant(db(c), session, async (tx) => {
      const [bill] = await tx`
        INSERT INTO public.bills
          (tenant_id, working_name, jurisdiction, locality, route, problem, intent, created_by)
        VALUES (
          coram.current_tenant_id(), ${input.workingName}, ${input.jurisdiction},
          ${input.locality ?? null}, ${input.route}::coram.bill_route,
          ${input.problem ?? null}, ${input.intent ?? null},
          (SELECT m.id FROM public.memberships m
                    WHERE m.user_id = coram.current_user_id()
                      AND m.tenant_id = coram.current_tenant_id())
        )
        RETURNING id, working_name, jurisdiction, locality, route, stage, created_at
      `;

      // The scaffold, so nobody starts from a blank page. The enacting clause
      // arrives filled in where the jurisdiction prescribes one.
      for (const s of scaffoldFor(input.jurisdiction)) {
        await tx`
          INSERT INTO public.bill_sections (tenant_id, bill_id, kind, position, heading, body)
          VALUES (coram.current_tenant_id(), ${bill.id}, ${s.kind}::coram.bill_section_kind,
                  ${s.position}, ${s.heading}, ${s.body})
        `;
      }

      return bill;
    });

    return c.json(ok(created), 201);
  } catch (error) {
    logFailure('petitio.bills.create', rid, error);
    return c.json(err('Could not start that bill.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

async function loadDraft(tx: Tx, id: string): Promise<{ row: Record<string, unknown>; draft: BillDraft } | null> {
  const [row] = await tx`
    SELECT id, working_name, jurisdiction, locality, route, stage, problem, intent,
           filed_as, filed_at, created_at, updated_at
    FROM public.bills WHERE id = ${id}::uuid
  `;
  if (!row) return null;

  const sections = await tx`
    SELECT kind, position, heading, body FROM public.bill_sections
    WHERE bill_id = ${id}::uuid ORDER BY kind, position
  `;

  return {
    row,
    draft: {
      workingName: row.working_name as string,
      jurisdiction: row.jurisdiction as string,
      locality: (row.locality as string | null) ?? null,
      route: row.route as BillDraft['route'],
      problem: (row.problem as string | null) ?? null,
      intent: (row.intent as string | null) ?? null,
      sections: sections.map((s) => ({
        kind: s.kind as SectionKind,
        position: s.position as number,
        heading: (s.heading as string | null) ?? null,
        body: (s.body as string) ?? '',
      })) as Section[],
    },
  };
}

petitio.get('/bills/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  try {
    const result = await withTenant(db(c), session, async (tx) => {
      const loaded = await loadDraft(tx, id);
      if (!loaded) return null;
      const endorsements = await tx`
        SELECT id, org_name, org_url, public, note, created_at
        FROM public.bill_endorsements WHERE bill_id = ${id}::uuid ORDER BY org_name
      `;
      return { ...loaded, endorsements };
    });

    if (!result) return c.json(err('No such bill.', ERROR.NOT_FOUND, rid), 404);

    return c.json(
      ok({
        bill: result.row,
        sections: result.draft.sections,
        endorsements: result.endorsements,
        // Advice, on every read. Never a gate.
        issues: reviewDraft(result.draft),
        ready: isReady(result.draft),
        routes: routesFor(result.draft.jurisdiction),
      }),
    );
  } catch (error) {
    logFailure('petitio.bills.get', rid, error);
    return c.json(err('Could not load that bill.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

petitio.patch('/bills/:id', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  /*
   * A bill number is the one milestone in this whole process that a group cannot
   * award itself. Refusing the stage without it is not bookkeeping: a product
   * that let someone mark their draft "filed" would be letting them believe a
   * legislator had acted.
   */
  const needsNumber = (['filed', 'in_committee', 'passed'] as const).includes(
    input.stage as 'filed' | 'in_committee' | 'passed',
  );
  if (needsNumber && !input.filedAs) {
    return c.json(
      err(
        'A filed bill has a number. Add the one the chamber assigned it — only a legislator can ' +
          'cause this stage, and recording it without the number would be recording a hope.',
        ERROR.VALIDATION,
        rid,
      ),
      400,
    );
  }

  try {
    const updated = await withTenant(db(c), session, async (tx) => {
      const [row] = await tx`
        UPDATE public.bills SET
          working_name = COALESCE(${input.workingName ?? null}, working_name),
          locality = CASE WHEN ${input.locality !== undefined} THEN ${input.locality ?? null} ELSE locality END,
          problem  = CASE WHEN ${input.problem  !== undefined} THEN ${input.problem  ?? null} ELSE problem  END,
          intent   = CASE WHEN ${input.intent   !== undefined} THEN ${input.intent   ?? null} ELSE intent   END,
          stage    = COALESCE(${input.stage ?? null}::coram.bill_stage, stage),
          filed_as = CASE WHEN ${input.filedAs !== undefined} THEN ${input.filedAs ?? null} ELSE filed_as END,
          filed_at = CASE
                       WHEN ${input.filedAs ?? null} IS NOT NULL AND filed_at IS NULL THEN now()
                       ELSE filed_at
                     END
        WHERE id = ${id}::uuid
        RETURNING id, working_name, stage, filed_as, filed_at, updated_at
      `;
      if (!row) return null;
      return row;
    });

    if (!updated) return c.json(err('No such bill.', ERROR.NOT_FOUND, rid), 404);
    return c.json(ok(updated));
  } catch (error) {
    logFailure('petitio.bills.update', rid, error);
    return c.json(err('Could not save that.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

petitio.put('/bills/:id/sections', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const parsed = z
    .object({ sections: z.array(sectionSchema).max(200) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  try {
    const result = await withTenant(db(c), session, async (tx) => {
      const [bill] = await tx`SELECT id, jurisdiction FROM public.bills WHERE id = ${id}::uuid`;
      if (!bill) return null;

      /*
       * Replace wholesale rather than diffing. The editor holds the whole
       * document, sections are reordered as often as they are edited, and a
       * partial update model here produced exactly the kind of orphaned-row bug
       * that is invisible until someone's severability clause is missing.
       */
      await tx`DELETE FROM public.bill_sections WHERE bill_id = ${id}::uuid`;
      for (const s of parsed.data.sections) {
        await tx`
          INSERT INTO public.bill_sections (tenant_id, bill_id, kind, position, heading, body)
          VALUES (coram.current_tenant_id(), ${id}, ${s.kind}::coram.bill_section_kind,
                  ${s.position}, ${s.heading ?? null}, ${s.body})
        `;
      }

      return loadDraft(tx, id);
    });

    if (!result) return c.json(err('No such bill.', ERROR.NOT_FOUND, rid), 404);

    return c.json(
      ok({ sections: result.draft.sections, issues: reviewDraft(result.draft), ready: isReady(result.draft) }),
    );
  } catch (error) {
    logFailure('petitio.sections.put', rid, error);
    return c.json(err('Could not save the draft.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

/** The bill as plain text, for pasting into an email to a scheduler. */
petitio.get('/bills/:id/text', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');
  const withProblem = c.req.query('problem') === '1';

  try {
    const loaded = await withTenant(db(c), session, (tx) => loadDraft(tx, id));
    if (!loaded) return c.text('No such bill.\n', 404);

    return c.text(renderBill(loaded.draft, { includeProblem: withProblem }), 200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="bill-${id.slice(0, 8)}.txt"`,
    });
  } catch (error) {
    logFailure('petitio.bills.text', rid, error);
    return c.text('Could not render that bill.\n', 500);
  }
});

// ---------------------------------------------------------------------------
// Endorsements — organisations, never individuals
// ---------------------------------------------------------------------------

const endorsementSchema = z.object({
  orgName: z.string().trim().min(1, 'Name the organisation.').max(160),
  orgUrl: z.string().trim().url('That does not look like a URL.').max(400).optional(),
  /** Defaults to false. An endorsement gathered privately is not a press release. */
  public: z.boolean().default(false),
  note: z.string().trim().max(1_000).optional(),
});

petitio.post('/bills/:id/endorsements', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const parsed = endorsementSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  try {
    const row = await withTenant(db(c), session, async (tx) => {
      const [created] = await tx`
        INSERT INTO public.bill_endorsements (tenant_id, bill_id, org_name, org_url, public, note)
        VALUES (coram.current_tenant_id(), ${id}, ${input.orgName}, ${input.orgUrl ?? null},
                ${input.public}, ${input.note ?? null})
        ON CONFLICT (bill_id, org_name) DO UPDATE
          SET org_url = EXCLUDED.org_url, public = EXCLUDED.public, note = EXCLUDED.note
        RETURNING id, org_name, org_url, public, note, created_at
      `;
      return created;
    });

    return c.json(ok(row), 201);
  } catch (error) {
    logFailure('petitio.endorsements.create', rid, error);
    return c.json(err('Could not record that endorsement.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// Outreach — read migrations/0012_petitio.sql's header note before extending
// ---------------------------------------------------------------------------

const outreachSchema = z.object({
  /** An ocd-person id, a bioguide id, or a plain office name. Never a person record. */
  officeRef: z.string().trim().min(1, 'Which office?').max(120),
  officeName: z.string().trim().min(1, 'What is the office called?').max(200),
  outcome: z.enum(['requested', 'scheduled', 'met', 'declined', 'no_response', 'committed', 'refused']),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-08-14.'),
  /*
   * Capped short, and deliberately.
   *
   * This is the field where a private assessment of a named staffer would end up
   * if anywhere, and the migration's header note explains why this product does
   * not accumulate those. 500 characters holds "asked for a meeting, they want a
   * fiscal note first" and does not comfortably hold a dossier.
   */
  note: z.string().trim().max(500).optional(),
});

petitio.get('/bills/:id/outreach', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  try {
    const rows = await withTenant(db(c), session, (tx) => tx`
      SELECT id, office_ref, office_name, outcome, occurred_on, by_member, note, created_at
      FROM public.bill_outreach WHERE bill_id = ${id}::uuid
      ORDER BY occurred_on DESC LIMIT 500
    `);
    return c.json(
      ok(rows, {
        notice:
          'Kept for two years — one legislative cycle — then deleted. We hold no contact details ' +
          'for legislators and no notes about their staff.',
      }),
    );
  } catch (error) {
    logFailure('petitio.outreach.list', rid, error);
    return c.json(err('Could not load the outreach log.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

petitio.post('/bills/:id/outreach', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  const parsed = outreachSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  try {
    const row = await withTenant(db(c), session, async (tx) => {
      const [created] = await tx`
        INSERT INTO public.bill_outreach
          (tenant_id, bill_id, office_ref, office_name, outcome, occurred_on, by_member, note)
        VALUES (coram.current_tenant_id(), ${id}, ${input.officeRef}, ${input.officeName},
                ${input.outcome}::coram.outreach_outcome, ${input.occurredOn}::date,
                (SELECT m.id FROM public.memberships m
                    WHERE m.user_id = coram.current_user_id()
                      AND m.tenant_id = coram.current_tenant_id()), ${input.note ?? null})
        RETURNING id, office_ref, office_name, outcome, occurred_on, note, created_at
      `;
      return created;
    });

    return c.json(ok(row), 201);
  } catch (error) {
    logFailure('petitio.outreach.create', rid, error);
    return c.json(err('Could not log that.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// Sponsors — who could carry this
// ---------------------------------------------------------------------------

/**
 * Committees and rosters for the bill's jurisdiction, chair first.
 *
 * Not gated on the draft being finished. The group most likely to want this is
 * the one that already knows which office to approach, and making them complete
 * a severability clause first would be the gating this module exists without.
 *
 * `limitations` is part of the payload rather than a UI concern. The whole risk
 * of a feature called sponsor matching is that a list gets read as a
 * recommendation, and the response says in words that it is not one.
 */
petitio.get('/bills/:id/sponsors', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const id = c.req.param('id');

  try {
    const result = await withTenant(db(c), session, async (tx) => {
      const [bill] = await tx`
        SELECT jurisdiction, route FROM public.bills WHERE id = ${id}::uuid
      `;
      if (!bill) return null;

      /*
       * A bill's sponsors are in its own jurisdiction's legislature. There is
       * deliberately no federal branch here: `bill_route` has no 'federal'
       * value, because the field guide has no US record and a draft cannot yet
       * be created against Congress. An earlier version of this line mapped a
       * non-existent route to 'US', which looked like federal support and was
       * nothing of the kind.
       *
       * Federal rosters *are* reachable — GET /sponsors/US serves them, and the
       * congress.* sources are ingested and current. What is missing is federal
       * drafting: an enacting clause, a chamber, and bill-numbering conventions
       * for Congress in the pathway data. Until that exists, this route answers
       * for the fifty states and DC only.
       */
      return sponsorOptions(tx, bill.jurisdiction as string);
    });

    if (!result) return c.json(err('No such bill.', ERROR.NOT_FOUND, rid), 404);
    return c.json(ok(result));
  } catch (error) {
    logFailure('petitio.sponsors', rid, error);
    return c.json(err('Could not load possible sponsors.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

/** The same, for a jurisdiction rather than a bill — used before a draft exists. */
petitio.get('/sponsors/:code', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;
  const code = c.req.param('code').toUpperCase();

  if (code !== 'US' && !JURISDICTIONS.has(code)) {
    return c.json(err('Pick one of the fifty states, DC, or US for Congress.', ERROR.VALIDATION, rid), 400);
  }

  try {
    const result = await withTenant(db(c), session, (tx) => sponsorOptions(tx, code));
    return c.json(ok(result));
  } catch (error) {
    logFailure('petitio.sponsors.jurisdiction', rid, error);
    return c.json(err('Could not load possible sponsors.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});
