/**
 * federatedAudit — drop-in helper for writing to public.federated_audit.
 *
 * Use this anywhere in the federation (host or satellite) to record a
 * significant action — lead creation, content publish, role grant, manual
 * override, anything a gardener would later want to find in /operator/audit.
 *
 * Design contract:
 *   - Fire-and-forget. Never throw. Never block the user-facing flow on
 *     audit write success — if Supabase is unreachable we log to console
 *     and move on. The whole point of an audit log is that it's a
 *     supplementary observation; failing the actual operation because the
 *     observation couldn't be written is worse than missing the observation.
 *   - source_app is REQUIRED. Every event must be attributable to one app
 *     in the federation_apps registry. Pass the slug, not the display name.
 *   - actor_email and actor_id are auto-resolved from the current Supabase
 *     session if present, but callers may override (useful for service-
 *     role contexts and webhook handlers where the "actor" is an external
 *     system, e.g. 'stripe' or 'lulu').
 *   - The `payload` field is jsonb — keep it small and avoid PHI/PII.
 *     Stick to ids, slugs, and status fields. If you need to record a
 *     diff, summarize it; don't dump the whole row.
 *
 * Action naming convention:
 *   '<noun>.<verb>'  e.g. 'lead.create', 'content.publish', 'gardener.grant',
 *                    'override.apply', 'user.invite'
 *   Use lowercase dot-separated kebab. Keep verbs in the imperative form
 *   we use elsewhere: create, update, delete, publish, archive, grant,
 *   revoke, send, fail, retry, redirect.
 *
 * Example:
 *   import { recordAudit } from '@/lib/federatedAudit';
 *   await someMutation();
 *   void recordAudit({
 *     sourceApp: 'thecros',
 *     action: 'lead.create',
 *     resource: `inbound_leads:${lead.id}`,
 *     payload: { kind: lead.kind, source_url: lead.source_url },
 *   });
 *
 * (We intentionally use `void` at the call site to make the fire-and-forget
 * nature explicit — eslint will warn on unawaited Promises otherwise.)
 */
import { supabase } from '@/integrations/supabase/client';

export interface AuditEventInput {
  /** federation_apps.slug — required. e.g. 'thecros', 'theschola', 'vigilia'. */
  sourceApp: string;

  /** '<noun>.<verb>' — required. e.g. 'lead.create', 'content.publish'. */
  action: string;

  /** Free-form resource identifier. Convention: '<table>:<id>'. */
  resource?: string | null;

  /** Small jsonb payload. Keep to ids/slugs/statuses. NO PHI/PII. */
  payload?: Record<string, unknown>;

  /** Override the actor email. Defaults to the current session's email. */
  actorEmail?: string | null;

  /** Override the actor user id. Defaults to the current session's user id. */
  actorId?: string | null;
}

/**
 * Write a row to public.federated_audit. Returns void; never throws.
 *
 * If you genuinely need to know whether the write succeeded (e.g. for tests
 * or a synchronous compliance flow), use {@link recordAuditStrict} instead.
 */
export async function recordAudit(event: AuditEventInput): Promise<void> {
  try {
    await writeAudit(event);
  } catch (err) {
    // Last-resort: log and swallow. We do NOT propagate.
    // eslint-disable-next-line no-console
    console.warn('[federatedAudit] write failed (swallowed):', err);
  }
}

/**
 * Strict variant. Throws on failure. Use only when the audit write itself
 * is part of the operation's success criteria — e.g. a compliance action
 * that legally requires the log entry.
 */
export async function recordAuditStrict(event: AuditEventInput): Promise<void> {
  await writeAudit(event);
}

async function writeAudit(event: AuditEventInput): Promise<void> {
  if (!event.sourceApp || !event.action) {
    throw new Error('federatedAudit: sourceApp and action are required');
  }

  // Resolve actor from the current session unless overridden.
  let actorId = event.actorId ?? null;
  let actorEmail = event.actorEmail ?? null;
  if (actorId === null && actorEmail === null) {
    try {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        actorId = u.id;
        actorEmail = u.email ?? null;
      }
    } catch {
      // No session available — fine, leave actor unset (e.g. anonymous
      // intake hits or background jobs).
    }
  }

  const row = {
    source_app: event.sourceApp,
    action: event.action,
    resource: event.resource ?? null,
    payload: event.payload ?? {},
    actor_id: actorId,
    actor_email: actorEmail,
    // ip and user_agent are intentionally NOT set client-side — the
    // browser cannot determine its own egress IP truthfully, and the
    // user_agent string is already in request headers if you need it.
    // Edge-function callers should populate ip/user_agent from headers.
  };

  // The federated_audit_insert RLS policy allows any authenticated user
  // to insert. Anonymous calls will get rejected at the RLS layer — which
  // is intentional: anon-side audit writes would be untrustworthy anyway.
  // For server-side / edge-function writes, use the service role key path
  // (writeAuditFromEdge below) which bypasses RLS by design.
  const { error } = await (supabase as any).from('federated_audit').insert(row);
  if (error) throw error;
}

/**
 * Edge-function variant. Uses an explicit service role client so the write
 * works without an authenticated user session. Pass it the createClient
 * instance you already have in your function — we don't import service-role
 * keys into the browser bundle.
 *
 * Example (Deno edge function):
 *   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 *   import { writeAuditFromEdge } from '...'; // copy this signature into _shared
 *   const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
 *   await writeAuditFromEdge(sb, {
 *     sourceApp: 'thecros',
 *     action: 'webhook.stripe.received',
 *     payload: { event_id: ev.id, type: ev.type },
 *   });
 *
 * (This file lives in src/lib so the browser can use it. The matching
 * Deno-side helper for satellite edge functions lives at
 * supabase/functions/_shared/federatedAudit.ts.)
 */
export interface EdgeAuditInput extends AuditEventInput {
  /** Optional client IP captured from request headers (e.g. CF-Connecting-IP). */
  ip?: string | null;
  /** Optional user-agent captured from request headers. */
  userAgent?: string | null;
}

// Loose typing on `client` so we don't drag a Deno SupabaseClient into the
// browser bundle. The runtime contract is just `.from(...).insert(...)`.
export async function writeAuditFromEdge(
  client: { from: (t: string) => { insert: (r: unknown) => Promise<{ error: unknown }> } },
  event: EdgeAuditInput,
): Promise<void> {
  if (!event.sourceApp || !event.action) {
    throw new Error('federatedAudit: sourceApp and action are required');
  }
  const row = {
    source_app: event.sourceApp,
    action: event.action,
    resource: event.resource ?? null,
    payload: event.payload ?? {},
    actor_id: event.actorId ?? null,
    actor_email: event.actorEmail ?? null,
    ip: event.ip ?? null,
    user_agent: event.userAgent ?? null,
  };
  const { error } = await client.from('federated_audit').insert(row);
  if (error) {
    // Edge callers usually want to log this server-side, not throw, since
    // the audit row is supplementary. But we propagate so the caller can
    // decide. Most callers should wrap this in try/catch + console.warn.
    throw error;
  }
}
