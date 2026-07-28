/**
 * Warrant canary staleness check (§7).
 *
 * The canary is a PGP-signed text file at /canary.txt. Signing is a manual
 * human act and this file must never do it — an auto-signed canary is worse
 * than no canary, because its whole evidentiary value rests on a person being
 * free to decline to sign.
 *
 * All this does is watch the clock:
 *   at 100 days  email the steward that it is due
 *   at 120 days  /trust displays "This canary is overdue"
 *
 * Publishing the cadence is what makes silence meaningful (§7).
 */

import type { Env } from '../env';

export const CANARY_WARN_DAYS = 100;
export const CANARY_OVERDUE_DAYS = 120;

/** KV key holding the ISO date of the most recent hand-signed canary. */
const CANARY_SIGNED_KEY = 'canary:last_signed_at';

export interface CanaryStatus {
  lastSignedAt: string | null;
  ageDays: number | null;
  state: 'fresh' | 'due' | 'overdue' | 'never_signed';
}

export async function canaryStatus(env: Env): Promise<CanaryStatus> {
  const stored = await env.KV_FLAGS.get(CANARY_SIGNED_KEY);
  if (!stored) return { lastSignedAt: null, ageDays: null, state: 'never_signed' };

  const signedAt = new Date(stored);
  if (Number.isNaN(signedAt.getTime())) {
    return { lastSignedAt: null, ageDays: null, state: 'never_signed' };
  }

  const ageDays = Math.floor((Date.now() - signedAt.getTime()) / 86_400_000);

  return {
    lastSignedAt: stored,
    ageDays,
    state:
      ageDays >= CANARY_OVERDUE_DAYS ? 'overdue' : ageDays >= CANARY_WARN_DAYS ? 'due' : 'fresh',
  };
}

export async function checkCanaryAge(env: Env): Promise<CanaryStatus> {
  const status = await canaryStatus(env);

  if (status.state === 'due' || status.state === 'never_signed') {
    // Delivery lands with Nuntius (§5.4). Logged until then so the signal is
    // at least visible in Workers observability rather than lost.
    console.warn('canary: %s at %s days — steward needs to sign', status.state, status.ageDays);
  }
  if (status.state === 'overdue') {
    console.error('canary: OVERDUE at %s days — /trust is now flagging it', status.ageDays);
  }

  return status;
}
