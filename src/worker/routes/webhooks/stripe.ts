/**
 * /webhooks/stripe — the satellite end of the CROS Stripe hub (§5.6).
 *
 * Coram does not talk to Stripe's webhooks directly. The hub receives them,
 * routes by `metadata.satellite_app`, and forwards a signed envelope here. The
 * contract, read off the hub's own forwarder:
 *
 *   POST <target_url_override>
 *   X-CROS-Federation-Signature: HMAC-SHA256 hex of the raw body
 *   X-CROS-Hub-Event-Id:         the Stripe event id
 *   body: { hub_event_id, satellite_app, stripe_event, delivered_at }
 *
 * Signature verification happens on the raw bytes before anything is parsed.
 * An unsigned or wrongly-signed request is refused before its JSON is read —
 * this endpoint is unauthenticated and reachable by anyone, so parsing first
 * would mean running our own JSON on an attacker's schedule.
 *
 * A webhook has no session and no tenant context, so RLS cannot apply to it —
 * but it is also a public endpoint, and handing a public endpoint the BYPASSRLS
 * cron role would give whoever reaches it the widest credential in the system.
 * So this connects as the ordinary coram_app role and does its work through
 * three narrow SECURITY DEFINER functions, exactly as the auth path in 0001
 * does. Each takes its tenant explicitly and scopes every write to it, and each
 * verifies the fund actually belongs to the tenant the event claims.
 */

import { Hono } from 'hono';

import type { Env, Vars } from '../../env';
import { timingSafeEqual } from '../../lib/crypto';
import { close, connect, withoutTenant, type Sql } from '../../lib/rls';

export const stripeWebhook = new Hono<{ Bindings: Env; Variables: Vars }>();

/** What Coram registers as with the hub, and what it stamps on its metadata. */
export const SATELLITE_APP = 'coram';

interface HubEnvelope {
  hub_event_id: string;
  satellite_app: string;
  stripe_event: StripeEvent;
  delivered_at: string;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

stripeWebhook.post('/stripe', async (c) => {
  const secret = c.env.FEDERATION_STRIPE_SECRET;
  if (!secret) {
    console.error('stripe webhook: FEDERATION_STRIPE_SECRET is not set');
    return c.json({ ok: false, error: 'not_configured' }, 500);
  }

  // Raw bytes, before any parsing. The hub signs exactly what it sent.
  const raw = await c.req.text();
  const signature = c.req.header('X-CROS-Federation-Signature');

  if (!signature || !(await verify(secret, raw, signature))) {
    // No detail in the response. An unauthenticated caller learns only that it
    // was refused, never why.
    return c.json({ ok: false, error: 'bad_signature' }, 401);
  }

  let envelope: HubEnvelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return c.json({ ok: false, error: 'bad_payload' }, 400);
  }

  if (envelope.satellite_app !== SATELLITE_APP) {
    // Correctly signed but misrouted. 200 so the hub does not retry something
    // that will never succeed here, and loud in the log because it means the
    // hub's routing table is wrong.
    console.error('stripe webhook: routed to coram but addressed to %s', envelope.satellite_app);
    return c.json({ ok: true, ignored: 'wrong_satellite' });
  }

  const sql = connect(c.env);
  c.executionCtx.waitUntil(close(sql));

  try {
    await handle(sql, envelope.stripe_event);
    return c.json({ ok: true });
  } catch (error) {
    console.error('stripe webhook: %s failed', envelope.stripe_event?.type, error);
    // 500 so the hub retries and, failing that, dead-letters. A payment event
    // we dropped silently is a donation that never reached a fund.
    return c.json({ ok: false, error: 'handler_failed' }, 500);
  }
});

// ---------------------------------------------------------------------------

async function handle(sql: Sql, event: StripeEvent): Promise<void> {
  const object = event.data?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, string>;

  const tenantId = metadata.tenant_id;
  const fundId = metadata.fund_id;

  if (!tenantId) {
    console.error('stripe webhook: %s carries no tenant_id in metadata', event.type);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'payment_intent.succeeded': {
      if (!fundId) {
        console.error('stripe webhook: %s carries no fund_id in metadata', event.type);
        return;
      }

      const amount = Number(object.amount_received ?? object.amount_total ?? 0);
      if (!Number.isSafeInteger(amount) || amount <= 0) return;

      /*
       * record_contribution is idempotent on (tenant_id, external_ref). The hub
       * retries on any non-2xx and Stripe redelivers on its own schedule, so
       * this endpoint will see the same event more than once — and a
       * double-counted donation is both a wrong thermometer and a wrong set of
       * books.
       *
       * It returns false when the fund does not belong to the tenant the event
       * names, which is worth logging rather than swallowing: it means either
       * the hub's routing table is wrong or someone is trying something.
       */
      const [credited] = await withoutTenant(
        sql,
        (tx) => tx`
          SELECT coram.record_contribution(
            ${tenantId}::uuid, ${fundId}::uuid, ${metadata.contact_id ?? null}::uuid,
            ${amount}, ${String(object.currency ?? 'usd')}, ${event.id}
          ) AS credited
        `,
      );

      if (!credited?.credited) {
        console.error('stripe webhook: fund %s does not belong to tenant %s', fundId, tenantId);
      }
      break;
    }

    case 'charge.refunded': {
      // Reverses the fund balance through the same trigger that credited it.
      await withoutTenant(
        sql,
        (tx) => tx`
          SELECT coram.refund_contribution(
            ${tenantId}::uuid, ${String(object.payment_intent ?? '')}
          )
        `,
      );
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await withoutTenant(
        sql,
        (tx) => tx`
          SELECT coram.set_subscription_status(
            ${tenantId}::uuid, ${String(object.id ?? '')},
            ${subscriptionStatus(event.type, String(object.status ?? ''))}
          )
        `,
      );
      break;
    }

    default:
      // Not an error. The hub forwards everything for the account and most of
      // it is not ours to act on.
      break;
  }
}

/**
 * Stripe's subscription statuses are more numerous than ours, and most of them
 * mean "not currently collecting". Mapping the long tail to 'cancelled' rather
 * than to 'active' is the safe direction: it stops a charge we are unsure
 * about, instead of continuing one.
 */
function subscriptionStatus(eventType: string, stripeStatus: string): string {
  if (eventType === 'customer.subscription.deleted') return 'cancelled';
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'paused') return 'paused';
  return 'cancelled';
}

/**
 * HMAC-SHA256 hex over the raw body, compared in constant time.
 *
 * Matches `hmacHex` in the hub's routing module byte for byte — same
 * algorithm, same hex encoding, same secret. If either side changes, every
 * payment event stops arriving, so it is worth saying where the other copy
 * lives: `supabase/functions/_shared/stripeHub/routing.ts` in the CROS repo.
 */
async function verify(secret: string, body: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  const expectedHex = [...expected].map((b) => b.toString(16).padStart(2, '0')).join('');

  return timingSafeEqual(enc.encode(expectedHex), enc.encode(signature.trim().toLowerCase()));
}

/**
 * Metadata to stamp on every Stripe object Coram creates.
 *
 * CLAUDE.md §6 mandates `source_app`. The hub's own router reads
 * `satellite_app` first and treats `source_app` as a legacy fallback, so both
 * are set — matching the spec while routing on the hub's preferred key.
 */
export function hubMetadata(tenantId: string, extra: Record<string, string> = {}) {
  return {
    source_app: SATELLITE_APP,
    satellite_app: SATELLITE_APP,
    tenant_id: tenantId,
    ...extra,
  };
}
