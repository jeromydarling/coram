/**
 * Warrant canary staleness check (§7).
 *
 * The canary is a PGP-signed text file at /canary.txt. Signing is a manual
 * human act and this file must never do it — an auto-signed canary is worse
 * than no canary, because its whole evidentiary value rests on a person being
 * free to decline to sign.
 *
 * All this does is watch the clock:
 *   at 100 days  warn the steward that it is due
 *   at 120 days  /trust displays "Overdue"
 *
 * Both numbers live in `lib/trust.ts` alongside the other three artifacts,
 * and this job reads the same KV record `/trust` renders. Keeping a second
 * copy of the date here would let the alert and the public page disagree, and
 * the public page is the one people act on.
 *
 * Publishing the cadence is what makes silence meaningful (§7).
 */

import type { Env } from '../env';
import { ageInDays, loadArtifact, staleness, type Staleness } from '../lib/trust';

export interface CanaryStatus {
  lastSignedAt: string | null;
  ageDays: number | null;
  state: Staleness;
}

export async function checkCanaryAge(env: Env): Promise<CanaryStatus> {
  const artifact = await loadArtifact(env, 'canary');
  const status: CanaryStatus = {
    lastSignedAt: artifact.publishedAt,
    ageDays: ageInDays(artifact),
    state: staleness(artifact),
  };

  if (status.state === 'due' || status.state === 'never_published') {
    // Delivery lands with Nuntius (§5.4). Logged until then so the signal is
    // at least visible in Workers observability rather than lost.
    console.warn('canary: %s at %s days — steward needs to sign', status.state, status.ageDays);
  }
  if (status.state === 'overdue') {
    console.error('canary: OVERDUE at %s days — /trust is now flagging it', status.ageDays);
  }

  return status;
}
