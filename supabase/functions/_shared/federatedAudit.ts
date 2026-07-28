// @ts-nocheck
/**
 * federatedAudit (edge-function variant)
 *
 * Drop-in helper for writing to public.federated_audit from any Supabase
 * Edge Function in the federation. Works for both:
 *   - Functions running inside thecros-work (e.g. stripe-webhook,
 *     activation-bootstrap), which already have a service-role client.
 *   - Functions running inside satellite repos (vigilia-work,
 *     heritage-kitchen-work, theschola-work, etc.) once they federate
 *     their audit writes against the same thecros Supabase project.
 *
 * For satellites pointing at their own Supabase project, this helper
 * accepts a custom URL + service-role key so they can write into the
 * federation's audit table directly. (The audit table is the single
 * source of truth — there is no per-app audit table.)
 *
 * Usage (function inside thecros-work):
 *   import { recordAuditFromEdge } from '../_shared/federatedAudit.ts';
 *   const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
 *   await recordAuditFromEdge(sb, {
 *     sourceApp: 'thecros',
 *     action: 'webhook.stripe.received',
 *     resource: `stripe_events:${event.id}`,
 *     payload: { type: event.type },
 *     ip: req.headers.get('cf-connecting-ip'),
 *     userAgent: req.headers.get('user-agent'),
 *   });
 *
 * Usage (function inside a satellite repo):
 *   import { recordAuditFromSatellite } from '../_shared/federatedAudit.ts';
 *   await recordAuditFromSatellite({
 *     sourceApp: 'vigilia',
 *     action: 'order.shipped',
 *     resource: `cookbook_projects:${projectId}`,
 *     payload: { tracking_id: trackingId },
 *     // CROS_FEDERATION_URL and CROS_FEDERATION_SERVICE_ROLE_KEY come
 *     // from the satellite's env config.
 *   });
 *
 * Design contract is identical to src/lib/federatedAudit.ts:
 *   - Never block the user-facing flow on an audit write.
 *   - source_app + action are required.
 *   - payload is jsonb — keep it small. NO PHI/PII.
 */

export interface EdgeAuditInput {
  sourceApp: string;
  action: string;
  resource?: string | null;
  payload?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Write to federated_audit using an existing Supabase client. Use this in
 * functions that already construct a service-role client (most do).
 * Returns true on success, false on failure (and logs the error). Never
 * throws — audit writes are supplementary observations, not load-bearing.
 */
export async function recordAuditFromEdge(
  client: {
    from: (t: string) => {
      insert: (r: unknown) => Promise<{ error: unknown | null }>;
    };
  },
  event: EdgeAuditInput,
): Promise<boolean> {
  if (!event.sourceApp || !event.action) {
    console.warn('[federatedAudit] missing sourceApp or action; skipping');
    return false;
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
  try {
    const { error } = await client.from('federated_audit').insert(row);
    if (error) {
      console.warn('[federatedAudit] insert error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[federatedAudit] threw:', err);
    return false;
  }
}

/**
 * Convenience wrapper for SATELLITE edge functions whose Supabase project
 * is NOT the thecros federation project. Reads federation URL + key from
 * env on every call (cheap; just env access). The satellite must have
 * CROS_FEDERATION_URL and CROS_FEDERATION_SERVICE_ROLE_KEY set in its
 * function env. If either is missing, the call no-ops with a warning so
 * we don't break local dev.
 */
export async function recordAuditFromSatellite(event: EdgeAuditInput): Promise<boolean> {
  const url = Deno.env.get('CROS_FEDERATION_URL');
  const key = Deno.env.get('CROS_FEDERATION_SERVICE_ROLE_KEY');
  if (!url || !key) {
    console.warn(
      '[federatedAudit] satellite is missing CROS_FEDERATION_URL or CROS_FEDERATION_SERVICE_ROLE_KEY; skipping',
    );
    return false;
  }
  // Lazy-import the Supabase client so functions that don't use this
  // helper don't pay the bundle cost.
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
  const client = createClient(url, key);
  return recordAuditFromEdge(client as unknown as Parameters<typeof recordAuditFromEdge>[0], event);
}
