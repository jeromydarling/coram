/**
 * public-leads-intake — Universal lead intake for the CROS family of apps.
 *
 * WHAT: Public, anon-callable POST endpoint. Accepts marketing/demo/waitlist
 *       form submissions from every CROS-family app and writes a normalized
 *       row to public.inbound_leads with source attribution.
 * WHERE: Called by the shared <CrosLeadForm /> component (React) and the
 *        vanilla cros-lead-form.js drop-in (any framework). Origins must
 *        appear in _shared/cors.ts.
 * WHY: Layer 1 of the CROS federation plan — collapses lead-collection
 *      across 17 apps into one console. See CROS_LEAD_INTAKE_BUILD_SPEC.md.
 *
 * Security model:
 *   • Public endpoint (verify_jwt = false in supabase/config.toml).
 *   • IP-based rate limit: 5 submissions/minute/IP (rateLimitPublic).
 *   • Honeypot field rejects obvious bots silently.
 *   • Bot-UA heuristic flags as spam (still stored, status='spam').
 *   • CORS allowlist enforced (see _shared/cors.ts).
 *   • Optional shared secret (LEADS_INTAKE_SECRET) tightens trust if set.
 *   • Soft-dedupe via sha256(email|source_app|YYYY-MM-DD) — second submit
 *     within the same UTC day from the same app/email is a no-op success.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1';
import { withErrorEnvelope, successResponse, errorResponse, ERROR_CODES } from '../_shared/errorEnvelope.ts';
import { isRateLimited, getClientIp, isLikelyBot } from '../_shared/rateLimitPublic.ts';

// ── Constants ───────────────────────────────────────────────────────────
const MAX_NAME = 120;
const MAX_EMAIL = 255;
const MAX_ORG = 200;
const MAX_MESSAGE = 4000;
const MAX_INTEREST = 200;
const MAX_PHONE = 30;
const MAX_VARIANT = 64;
const MAX_URL = 2048;
const MAX_PAGE = 1024;

// Slugs of every known CROS-family app. Keeping this list explicit prevents
// random apps from spraying junk into our pipeline.
const KNOWN_SOURCE_APPS = new Set([
  'thecros',
  'theschola',
  'hortus',
  'refugium',
  'resurrectio',
  'transitus',
  'vigilia',
  'communis',
  'propria',
  'cormundum',
  'bitoku',
  'rehearso',
  'heritage-kitchen',
  'via-publica',
  'fabrica-forge',
  'catholic-insurance',
  'vrtmethod',
]);

const ALLOWED_LEAD_KINDS = new Set(['demo', 'waitlist', 'contact', 'feedback', 'partner', 'beta']);

// ── Helpers ─────────────────────────────────────────────────────────────
function trimOrNull(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Handler ─────────────────────────────────────────────────────────────
Deno.serve(
  withErrorEnvelope(async (req) => {
    if (req.method !== 'POST') {
      return errorResponse(req, 'Method not allowed. Use POST.', ERROR_CODES.VALIDATION_ERROR, 405);
    }

    // Optional shared-secret check — set LEADS_INTAKE_SECRET to enforce
    const requiredSecret = Deno.env.get('LEADS_INTAKE_SECRET');
    if (requiredSecret) {
      const provided = req.headers.get('x-cros-intake-secret');
      if (provided !== requiredSecret) {
        return errorResponse(req, 'Invalid intake secret', ERROR_CODES.UNAUTHORIZED, 401);
      }
    }

    // Rate limit by IP — 5/min is generous for a real human, brutal for bots
    const ip = getClientIp(req);
    if (isRateLimited(`public-leads-intake:${ip}`, 60_000, 5)) {
      return errorResponse(req, 'Too many requests. Please slow down.', ERROR_CODES.RATE_LIMITED, 429);
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return errorResponse(req, 'Invalid JSON', ERROR_CODES.VALIDATION_ERROR);
    }

    // Honeypot — silently 200 so bots don't learn anything
    if (typeof body.honeypot === 'string' && body.honeypot.trim() !== '') {
      return successResponse(req, { id: null, deduped: false, accepted: false });
    }

    // ── Required fields ───────────────────────────────────────────────
    const name = trimOrNull(body.name, MAX_NAME);
    const email = trimOrNull(body.email, MAX_EMAIL);

    if (!name) return errorResponse(req, 'Name is required', ERROR_CODES.VALIDATION_ERROR);
    if (!email) return errorResponse(req, 'Email is required', ERROR_CODES.VALIDATION_ERROR);
    if (!EMAIL_RE.test(email)) return errorResponse(req, 'Invalid email format', ERROR_CODES.VALIDATION_ERROR);

    // ── Attribution ───────────────────────────────────────────────────
    const sourceApp = trimOrNull(body.source_app, 64);
    if (!sourceApp) {
      return errorResponse(req, 'source_app is required', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!KNOWN_SOURCE_APPS.has(sourceApp)) {
      return errorResponse(req, `Unknown source_app: ${sourceApp}`, ERROR_CODES.VALIDATION_ERROR);
    }

    const leadKind = trimOrNull(body.lead_kind, 32) ?? 'demo';
    if (!ALLOWED_LEAD_KINDS.has(leadKind)) {
      return errorResponse(req, `Invalid lead_kind: ${leadKind}`, ERROR_CODES.VALIDATION_ERROR);
    }

    // ── Optional fields ───────────────────────────────────────────────
    const organization = trimOrNull(body.organization, MAX_ORG);
    const message = trimOrNull(body.message, MAX_MESSAGE);
    const archetype = trimOrNull(body.archetype, 64);
    const interest = trimOrNull(body.interest, MAX_INTEREST);
    const phone = trimOrNull(body.phone, MAX_PHONE);
    const sourceUrl = trimOrNull(body.source_url, MAX_URL);
    const sourcePage = trimOrNull(body.source_page, MAX_PAGE);
    const formVariant = trimOrNull(body.form_variant, MAX_VARIANT);
    const utm_source = trimOrNull(body.utm_source, 128);
    const utm_medium = trimOrNull(body.utm_medium, 128);
    const utm_campaign = trimOrNull(body.utm_campaign, 128);
    const utm_term = trimOrNull(body.utm_term, 128);
    const utm_content = trimOrNull(body.utm_content, 128);
    const referrer = trimOrNull(body.referrer, MAX_URL);
    const userAgent = req.headers.get('user-agent')?.slice(0, 512) ?? null;

    // App-specific extra fields (whitelisted at the schema level — we just persist)
    const extra = (body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra))
      ? (body.extra as Record<string, unknown>)
      : {};

    // ── Spam heuristics ───────────────────────────────────────────────
    const looksLikeBot = isLikelyBot(req);
    const initialStatus = looksLikeBot ? 'spam' : 'new';

    // ── Soft dedupe ───────────────────────────────────────────────────
    const day = new Date().toISOString().slice(0, 10); // UTC day bucket
    const dedupeKey = await sha256Hex(`${email.toLowerCase()}|${sourceApp}|${day}`);
    const ipHash = ip === 'unknown' ? null : await sha256Hex(`${ip}|${day}`);

    // ── Persist ───────────────────────────────────────────────────────
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const insertPayload = {
      name,
      email,
      organization,
      archetype,
      message,
      honeypot: null,
      source_app: sourceApp,
      source_url: sourceUrl,
      source_page: sourcePage,
      form_variant: formVariant,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      referrer,
      user_agent: userAgent,
      ip_hash: ipHash,
      lead_kind: leadKind,
      interest,
      phone,
      extra,
      dedupe_key: dedupeKey,
      status: initialStatus,
    };

    const { data, error } = await supabase
      .from('inbound_leads')
      .insert(insertPayload)
      .select('id, created_at')
      .single();

    if (error) {
      // Unique-violation on dedupe_key → idempotent success
      // Postgres code 23505 = unique_violation
      if ((error as { code?: string }).code === '23505') {
        return successResponse(req, { id: null, deduped: true, accepted: true }, undefined, 200);
      }
      console.error('[public-leads-intake] insert error:', error);
      return errorResponse(req, 'Failed to record lead', ERROR_CODES.INTERNAL_ERROR, 500);
    }

    return successResponse(
      req,
      {
        id: data.id,
        deduped: false,
        accepted: true,
        flagged_spam: looksLikeBot,
        created_at: data.created_at,
      },
      undefined,
      201,
    );
  }),
);
