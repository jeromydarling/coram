/**
 * rails — moving money in and out.
 *
 * Two rails are named in §5.6: Stripe Connect through the CROS hub, and a
 * "Bitcoin/Lightning fallback rail for deplatforming resilience". Neither
 * adapter is implemented here, for different reasons worth distinguishing.
 *
 * **Stripe** is a wiring problem, not a design one. The hub contract is known
 * and implemented on the inbound side (routes/webhooks/stripe.ts). What is
 * missing is the outbound half: creating a Checkout session against a
 * connected account requires that account's id and the hub's credentials, and
 * neither exists until a workspace has been onboarded through
 * `stripe-connect-onboard` on the hub. So this is blocked on operations rather
 * than on code.
 *
 * **Lightning** is a real design decision that has not been made. The point of
 * §5.6's fallback is that a bail fund keeps working after a card processor
 * decides it would rather not serve one — which is a thing that happens, and
 * the reason the requirement is in the spec at all. But the resilience only
 * holds if the fallback is not itself a custodial account someone can freeze,
 * and that pushes toward either the group running its own node or a
 * non-custodial arrangement where Coram never holds the keys. That choice
 * changes what the escrow model means, so it should be made deliberately
 * rather than by whoever implements this file first.
 *
 * The database is ready for both: `contributions.rail` is already
 * 'stripe' | 'lightning', so adding the second rail is not a migration.
 *
 * Like lib/sender.ts, the default here fails loudly. A payment path that
 * silently reports success would tell an organizer money arrived when it did
 * not, which on a bail fund is not a bug — it is someone staying in jail.
 */

import type { Env } from '../env';
import type { FundKind } from './takerate';

export type Rail = 'stripe' | 'lightning';

export interface CheckoutRequest {
  tenantId: string;
  fundId: string;
  fundKind: FundKind;
  amountCents: number;
  currency: string;
  /** Absent for an anonymous gift, which §5.6 supports. */
  contactId?: string;
  returnUrl: string;
}

export type CheckoutResult =
  | { ok: true; redirectUrl: string; externalRef: string }
  | { ok: false; reason: string };

export interface PayoutRequest {
  tenantId: string;
  disbursementId: string;
  amountCents: number;
  currency: string;
}

export type PayoutResult = { ok: true; externalRef: string } | { ok: false; reason: string };

export interface PaymentRail {
  checkout(request: CheckoutRequest): Promise<CheckoutResult>;
  payout(request: PayoutRequest): Promise<PayoutResult>;
}

const NOT_WIRED =
  'No payment rail is connected. This workspace has not completed Stripe onboarding ' +
  'through the CROS hub. See src/worker/lib/rails.ts.';

class UnconfiguredRail implements PaymentRail {
  async checkout(): Promise<CheckoutResult> {
    return { ok: false, reason: NOT_WIRED };
  }

  async payout(): Promise<PayoutResult> {
    return { ok: false, reason: NOT_WIRED };
  }
}

export function getRail(_env: Env, _rail: Rail = 'stripe'): PaymentRail {
  return new UnconfiguredRail();
}

/**
 * Everything Coram stamps on a Stripe object, so the hub can route the webhook
 * back and the handler can find the fund without a lookup table.
 *
 * `tenant_id` and `fund_id` are load-bearing: routes/webhooks/stripe.ts refuses
 * an event without them rather than guessing, because guessing which workspace
 * a payment belongs to is how money lands in the wrong fund.
 */
export function checkoutMetadata(request: CheckoutRequest): Record<string, string> {
  return {
    source_app: 'coram',
    satellite_app: 'coram',
    tenant_id: request.tenantId,
    fund_id: request.fundId,
    ...(request.contactId ? { contact_id: request.contactId } : {}),
  };
}
