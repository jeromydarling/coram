/**
 * Brand tokens and the flyer composer.
 *
 * Not a module (§5 is closed at eleven). Brand is workspace configuration; the
 * flyer is a Nuntius surface built from Convocare data. Grouped in one file
 * because they are one job to a user: make something we can put on a wall.
 *
 * The flyer route returns SVG rather than a raster image. A Worker has no
 * canvas, the destination is usually a copy shop, and vector prints crisply at
 * any size — every browser's print dialogue handles it, and a designer can
 * open it and change something.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { Env, Vars } from '../../env';
import { requireWorkspace } from '../../lib/auth';
import { db } from '../../lib/db';
import { ERROR, detailFor, err, logFailure, ok } from '../../lib/http';
import { withTenant } from '../../lib/rls';
import { record } from '../../lib/audit';
import { renderFlyer } from '../../lib/flyer';
import {
  CHANNELS,
  DEFAULT_BRAND,
  TEMPLATES,
  fitToChannel,
  legibilityIssues,
  normaliseHex,
  paletteFrom,
  postLength,
  type BrandProfile,
  type TemplateId,
} from '../../../shared/brand';

export const brand = new Hono<{ Bindings: Env; Variables: Vars }>();

/*
 * Every route here needs a workspace. Without this the unauthenticated case
 * reached withTenant with no session and surfaced as a 500 — an internal fault
 * where the honest answer is "sign in". auth.ts asks each group to declare its
 * own requirement precisely so a private route cannot be mistaken for a public
 * one, and this group was the one that forgot.
 */
brand.use('*', requireWorkspace);

const hex = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour, like #1f5f4f.')
  .transform(normaliseHex);

const brandSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name.').max(80),
  primary: hex,
  accent: hex,
  surface: hex,
  ink: hex,
});

type Row = {
  name: string;
  primary_hex: string;
  accent_hex: string;
  surface_hex: string;
  ink_hex: string;
  logo_key: string | null;
};

const toProfile = (row: Row): BrandProfile => ({
  name: row.name,
  primary: row.primary_hex,
  accent: row.accent_hex,
  surface: row.surface_hex,
  ink: row.ink_hex,
  logoKey: row.logo_key,
});

/** The workspace's brand, or the shipped default when nothing has been set. */
async function loadBrand(c: Parameters<typeof db>[0]): Promise<BrandProfile> {
  const sql = db(c);
  const session = c.get('session')!;

  return withTenant(sql, session, async (tx) => {
    const rows = await tx<Row[]>`
      SELECT name, primary_hex, accent_hex, surface_hex, ink_hex, logo_key
      FROM public.brand_profiles
      WHERE tenant_id = coram.current_tenant_id()
    `;
    return rows.length ? toProfile(rows[0]) : DEFAULT_BRAND;
  });
}

// ---------------------------------------------------------------------------
// GET /api/brand
// ---------------------------------------------------------------------------

brand.get('/', async (c) => {
  const rid = c.get('requestId');
  try {
    const profile = await loadBrand(c);
    return c.json(
      ok({
        brand: profile,
        // Sent alongside so the editor can show contrast while someone is
        // still choosing, rather than refusing at save time.
        issues: legibilityIssues(profile),
        templates: TEMPLATES,
        isDefault: profile === DEFAULT_BRAND,
      }),
    );
  } catch (error) {
    logFailure('brand.get', rid, error);
    return c.json(err('Could not load the brand.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/brand
// ---------------------------------------------------------------------------

brand.put('/', async (c) => {
  const rid = c.get('requestId');

  const parsed = brandSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const candidate: BrandProfile = { ...parsed.data, logoKey: null };

  /*
   * Contrast is refused here, not warned about. These colours end up on a
   * printed sheet on a noticeboard in a badly lit corridor; a palette that
   * fails WCAG AA is not a style choice, it is a flyer nobody reads. The
   * response names the failing pair and the ratio so the editor can say
   * exactly what to change.
   */
  const issues = legibilityIssues(candidate);
  if (issues.length) {
    return c.json(
      {
        ...err('These colours would not be readable in print.', ERROR.VALIDATION, rid),
        issues,
      },
      422,
    );
  }

  const sql = db(c);
  const session = c.get('session')!;

  try {
    const saved = await withTenant(sql, session, async (tx) => {
      const rows = await tx<Row[]>`
        INSERT INTO public.brand_profiles
          (tenant_id, name, primary_hex, accent_hex, surface_hex, ink_hex)
        VALUES (
          coram.current_tenant_id(), ${candidate.name}, ${candidate.primary},
          ${candidate.accent}, ${candidate.surface}, ${candidate.ink}
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          name = EXCLUDED.name,
          primary_hex = EXCLUDED.primary_hex,
          accent_hex = EXCLUDED.accent_hex,
          surface_hex = EXCLUDED.surface_hex,
          ink_hex = EXCLUDED.ink_hex
        RETURNING name, primary_hex, accent_hex, surface_hex, ink_hex, logo_key
      `;
      // Brand is workspace configuration, so this is a workspace update rather
      // than a record write. The audit log names the type, never the values.
      await record(tx, { action: 'workspace.update', recordType: 'brand', recordCount: 1 });
      return toProfile(rows[0]);
    });

    return c.json(ok({ brand: saved, issues: [] }));
  } catch (error) {
    logFailure('brand.put', rid, error);
    return c.json(err('Could not save the brand.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/brand/flyer.svg
// ---------------------------------------------------------------------------

const flyerQuery = z.object({
  headline: z.string().trim().min(1).max(160),
  when: z.string().trim().min(1).max(120),
  where: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(240).optional(),
  cta: z.string().trim().max(80).optional(),
  template: z.enum(['notice', 'rally', 'meeting']).default('meeting'),
});

/**
 * A flyer, rendered on demand.
 *
 * Nothing is stored. The flyer is a view of an event and a brand, both of which
 * already exist, so saving one would be a third copy of the same facts that
 * then has to be kept in step and swept. Regenerating is cheap.
 */
brand.get('/flyer.svg', async (c) => {
  const rid = c.get('requestId');

  const parsed = flyerQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  try {
    const profile = await loadBrand(c);
    const svg = renderFlyer({
      brand: profile,
      template: parsed.data.template as TemplateId,
      content: {
        headline: parsed.data.headline,
        when: parsed.data.when,
        where: parsed.data.where,
        detail: parsed.data.detail,
        callToAction: parsed.data.cta,
      },
    });

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        // Derived from data the caller just supplied, and cheap to rebuild.
        // Caching it would only serve a stale poster after a brand change.
        'Cache-Control': 'no-store',
        'Content-Disposition': 'inline; filename="flyer.svg"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    logFailure('brand.flyer', rid, error);
    return c.json(err('Could not draw that flyer.', ERROR.INTERNAL, rid, detailFor(c.env, error)), 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/brand/suggest — a whole palette from one colour
// ---------------------------------------------------------------------------

const suggestSchema = z.object({
  seed: hex,
  name: z.string().trim().min(1).max(80).optional(),
});

/**
 * Propose, never apply.
 *
 * §7's rule for AI output — draft, label, let a human approve — is worth
 * keeping for generated output that involves no model at all. This returns a
 * palette and saves nothing; the group has to PUT it before anything changes.
 *
 * Deterministic rather than a model call: it needs no key, answers instantly
 * while someone drags a colour picker, and is the only version that can
 * guarantee the result passes the contrast gate rather than being rejected by
 * it a moment later.
 */
brand.post('/suggest', async (c) => {
  const rid = c.get('requestId');

  const parsed = suggestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const proposed = paletteFrom(parsed.data.seed, parsed.data.name);
  return c.json(
    ok({
      brand: proposed,
      issues: legibilityIssues(proposed),
      applied: false,
      note: 'A starting point. Nothing has been saved — send it back with PUT to apply it.',
    }),
  );
});

// ---------------------------------------------------------------------------
// GET /api/brand/share-kit — the words, per channel
// ---------------------------------------------------------------------------

const shareQuery = flyerQuery.extend({
  /** Where the post should send people. Optional. */
  link: z.string().trim().url().max(300).optional(),
});

/**
 * Per-channel drafts for one event.
 *
 * Export-first: Coram holds no posting credentials and does not post. An OAuth
 * token that can post as a tenants union is a subpoena target and a compromise
 * vector, and §7 forbids auto-sending regardless. So this hands back words and
 * a character count, and a person posts them.
 *
 * A draft that does not fit is reported as `fits: false` with the overflow,
 * rather than silently truncated — a post cut mid-sentence reads as careless,
 * and the group should choose what to drop.
 */
brand.get('/share-kit', async (c) => {
  const rid = c.get('requestId');

  const parsed = shareQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0].message, ERROR.VALIDATION, rid), 400);
  }

  const { headline, when, where, detail, link } = parsed.data;

  // Plain declarative sentences, no exclamation points (§2). The long form is
  // trimmed per channel rather than a different draft being written for each.
  const full = [`${headline}.`, `${when}, ${where}.`, detail].filter(Boolean).join(' ');

  const drafts = CHANNELS.map((channel) => {
    const text = fitToChannel(full, link, channel);
    return {
      channel: channel.id,
      name: channel.name,
      limit: channel.limit,
      text,
      length: text ? postLength(text, link, channel) : null,
      fits: text !== null,
      trimmed: text !== null && text !== full,
    };
  });

  return c.json(
    ok({
      drafts,
      link: link ?? null,
      note: 'Copy these and post them yourself. Coram does not hold your social accounts.',
    }),
  );
});
