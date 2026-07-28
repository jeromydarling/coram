/**
 * /api/funds/* — Thesaurus (§5.6).
 *
 * Note what this file does not do: it never computes a fee. `take_cents` is set
 * by a trigger from `coram.take_basis_points`, and anything sent here is
 * discarded. That is deliberate — §5.6 calls the bail and mutual aid waiver a
 * permanent commitment, and a fee the application could set is a fee somebody
 * could be persuaded to change.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { record } from '../../lib/audit';
import { requireWorkspace } from '../../lib/auth';
import { ERROR, err, ok } from '../../lib/http';
import { close, connect, withTenant } from '../../lib/rls';
import { describeTake, netCents, takeCents, type FundKind } from '../../lib/takerate';

export const funds = new Hono<{ Bindings: Env; Variables: Vars }>();

funds.use('*', requireWorkspace);

const fundKind = z.enum(['general', 'dues', 'mutual_aid', 'bail']);

const createFundSchema = z.object({
  name: z.string().trim().min(1, 'Name the fund.').max(200),
  description: z.string().trim().max(5_000).optional(),
  kind: fundKind,
  goalCents: z.number().int().positive().optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  isPublic: z.boolean().default(false),
});

const disbursementSchema = z.object({
  fundId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  /*
   * The one field in this module that could hold something it should not. A
   * bail disbursement naming its recipient puts that person in a seven-year
   * financial record, when §5.9 says jail support is purged 30 days after a
   * case closes. The UI says so; this only bounds the length.
   */
  purpose: z.string().trim().min(1, 'Say what this is for.').max(500),
});

// ---------------------------------------------------------------------------
// GET /api/funds
// ---------------------------------------------------------------------------

funds.get('/', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT f.id, f.name, f.kind, f.goal_cents, f.currency,
             f.raised_cents, f.disbursed_cents,
             (f.raised_cents - f.disbursed_cents) AS available_cents,
             f.is_public, f.public_slug, f.closed_at, f.created_at,
             (SELECT count(*) FROM public.contributions c
              WHERE c.fund_id = f.id AND c.status = 'settled')::int AS contributions
      FROM public.funds f
      ORDER BY f.created_at DESC
    `,
  );

  return c.json(
    ok(
      rows.map((row) => ({
        ...row,
        // Stated on every fund, not only the waived ones, so an organizer sees
        // the commitment rather than having to know about it.
        takeDescription: describeTake(row.kind as FundKind),
      })),
    ),
  );
});

// ---------------------------------------------------------------------------
// POST /api/funds
// ---------------------------------------------------------------------------

funds.post('/', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = createFundSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    const created = await withTenant(sql, session, async (tx) => {
      const [row] = await tx`
        INSERT INTO public.funds
          (tenant_id, name, description, kind, goal_cents, currency, is_public, public_slug, created_by)
        VALUES (
          coram.current_tenant_id(), ${input.name}, ${input.description ?? null},
          ${input.kind}::coram.fund_kind, ${input.goalCents ?? null}, ${input.currency},
          ${input.isPublic}, ${input.isPublic ? slug(input.name) : null},
          coram.current_user_id()
        )
        RETURNING id, name, kind, goal_cents, currency, public_slug
      `;
      return row;
    });

    if (!created) {
      return c.json(err('Only a steward can open a fund.', ERROR.FORBIDDEN, rid), 403);
    }

    return c.json(ok({ ...created, takeDescription: describeTake(input.kind) }), 201);
  } catch {
    return c.json(err('Could not open that fund.', ERROR.INTERNAL, rid), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/funds/:id/quote — what a gift of this size would actually deliver
//
// Exists so a donation page can show the split before anyone gives, rather
// than after. On a bail or mutual aid fund the answer is always "all of it".
// ---------------------------------------------------------------------------

funds.get('/:id/quote', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const amount = Number(c.req.query('amountCents'));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return c.json(err('Give an amount in cents.', ERROR.VALIDATION, rid), 400);
  }

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const [fund] = await withTenant(
    sql,
    session,
    (tx) => tx`SELECT kind, currency FROM public.funds WHERE id = ${c.req.param('id')}::uuid`,
  );

  if (!fund) return c.json(err('No such fund.', ERROR.NOT_FOUND, rid), 404);

  const kind = fund.kind as FundKind;
  return c.json(
    ok({
      amountCents: amount,
      platformTakeCents: takeCents(amount, kind),
      toTheGroupCents: netCents(amount, kind),
      currency: fund.currency,
      description: describeTake(kind),
    }),
  );
});

// ---------------------------------------------------------------------------
// GET /api/funds/:id/contributions
// ---------------------------------------------------------------------------

funds.get('/:id/contributions', async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withTenant(sql, session, async (tx) => {
    const found = await tx`
      SELECT c.id, c.amount_cents, c.take_cents, c.currency, c.rail, c.status,
             c.occurred_at, c.contact_id, ct.display_name
      FROM public.contributions c
      LEFT JOIN public.contacts ct ON ct.id = c.contact_id
      WHERE c.fund_id = ${id}::uuid
      ORDER BY c.occurred_at DESC
      LIMIT 500
    `;

    if (found.length) {
      await record(tx, { action: 'record.read', recordType: 'contribution', recordCount: found.length });
    }
    return found;
  });

  return c.json(
    ok(
      rows.map((row) => ({
        ...row,
        // Null contact_id is an anonymous gift, not a missing record. Say so,
        // or the UI will render it as an error.
        anonymous: row.contact_id === null,
      })),
    ),
  );
});

// ---------------------------------------------------------------------------
// Disbursements — §5.6 dual approval
// ---------------------------------------------------------------------------

funds.get('/disbursements', async (c) => {
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  const rows = await withTenant(
    sql,
    session,
    (tx) => tx`
      SELECT d.id, d.fund_id, f.name AS fund_name, f.kind,
             d.amount_cents, d.currency, d.purpose, d.status,
             d.requested_by, d.created_at, d.approved_at, d.paid_at,
             (SELECT count(*) FROM public.disbursement_approvals a
              WHERE a.disbursement_id = d.id)::int AS approvals
      FROM public.disbursements d
      JOIN public.funds f ON f.id = d.fund_id
      ORDER BY d.created_at DESC
      LIMIT 200
    `,
  );

  return c.json(
    ok(
      rows.map((row) => ({
        ...row,
        // Two, always. Surfaced rather than assumed so the UI never invents a
        // different threshold.
        approvalsRequired: 2,
      })),
    ),
  );
});

funds.post('/disbursements', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const parsed = disbursementSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }
  const input = parsed.data;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    const result = await withTenant(sql, session, async (tx) => {
      // Checked at proposal as well as at payment. Proposing a payout the fund
      // cannot cover wastes two stewards' attention before failing.
      const [fund] = await tx`
        SELECT (raised_cents - disbursed_cents) AS available, currency
        FROM public.funds WHERE id = ${input.fundId}::uuid
      `;
      if (!fund) return { kind: 'no_fund' as const };
      if (Number(fund.available) < input.amountCents) {
        return { kind: 'insufficient' as const, available: Number(fund.available) };
      }

      const [row] = await tx`
        INSERT INTO public.disbursements
          (tenant_id, fund_id, amount_cents, currency, purpose, requested_by)
        VALUES (
          coram.current_tenant_id(), ${input.fundId}::uuid, ${input.amountCents},
          ${input.currency}, ${input.purpose}, coram.current_user_id()
        )
        RETURNING id, status, amount_cents
      `;
      return { kind: 'proposed' as const, row };
    });

    if (result.kind === 'no_fund') {
      return c.json(err('No such fund.', ERROR.NOT_FOUND, rid), 404);
    }
    if (result.kind === 'insufficient') {
      return c.json(
        err(
          `That fund holds ${result.available} and the request is for ${input.amountCents}.`,
          ERROR.CONFLICT,
          rid,
        ),
        409,
      );
    }

    return c.json(
      ok(result.row, {
        message: 'Proposed. Two stewards other than you must approve before it can be paid.',
      }),
      201,
    );
  } catch {
    return c.json(err('Could not propose that payment.', ERROR.INTERNAL, rid), 500);
  }
});

funds.post('/disbursements/:id/approve', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    const [result] = await withTenant(
      sql,
      session,
      (tx) => tx`SELECT * FROM coram.approve_disbursement(${c.req.param('id')}::uuid)`,
    );

    return c.json(
      ok({
        status: result.status,
        approvals: Number(result.approvals),
        approvalsRequired: 2,
      }),
    );
  } catch (error) {
    return c.json(...disbursementError(error, rid));
  }
});

funds.post('/disbursements/:id/pay', async (c) => {
  const rid = c.get('requestId');
  const session = c.get('session')!;

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    await withTenant(sql, session, async (tx) => {
      await tx`SELECT coram.pay_disbursement(${c.req.param('id')}::uuid)`;
      await record(tx, { action: 'record.export', recordType: 'disbursement' });
    });

    // Moving the money itself is the provider's job and no provider is wired
    // yet — see the note in lib/rails.ts. The escrow ledger is now correct and
    // the payment is marked paid; a real rail settles against this record.
    return c.json(ok(undefined, { message: 'Recorded as paid.' }));
  } catch (error) {
    return c.json(...disbursementError(error, rid));
  }
});

// ---------------------------------------------------------------------------

function disbursementError(error: unknown, rid: string): [ReturnType<typeof err>, 403 | 404 | 409] {
  const code = (error as { code?: string })?.code;
  const detail = String((error as { message?: string })?.message ?? '');

  if (code === 'P0002') return [err('No such disbursement.', ERROR.NOT_FOUND, rid), 404];

  if (code === '42501') {
    // The two interesting refusals, distinguished because the fix differs: one
    // needs a different person, the other needs a different role.
    return [
      err(
        detail.includes('cannot approve it')
          ? 'The person who proposed a payment cannot be one of its approvers.'
          : 'Only a steward can approve or release a payment.',
        ERROR.FORBIDDEN,
        rid,
      ),
      403,
    ];
  }

  if (code === '23514') {
    return [
      err(
        detail.includes('holds')
          ? 'That fund no longer holds enough to cover this payment.'
          : 'Two stewards must approve a payment before it can be released.',
        ERROR.CONFLICT,
        rid,
      ),
      409,
    ];
  }

  return [err('Could not complete that.', ERROR.CONFLICT, rid), 409];
}

function slug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'fund'}-${crypto.randomUUID().slice(0, 6)}`;
}
