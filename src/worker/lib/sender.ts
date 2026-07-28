/**
 * sender — the seam between Coram and whatever actually delivers a message.
 *
 * CLAUDE.md §1.4 lists a queue for sends (`Q_SEND`) but names no email or SMS
 * provider, so the concrete adapter is a decision that has not been made. This
 * file is the shape it will take when it is: one interface, one place to plug
 * in, and a deliberately failing default so nothing silently no-ops in
 * production while appearing to work.
 *
 * Whatever provider is chosen has to satisfy three things that are not
 * negotiable, and they are worth having written down before the choice is made:
 *
 *   1. No open tracking, no click tracking, no per-recipient pixels. Most
 *      providers enable these by default and they are exactly the passive
 *      surveillance §5.1's engagement scoring deliberately excludes. If the
 *      provider cannot turn them off, it is the wrong provider.
 *   2. Bounce and complaint callbacks, so the ledger can be updated.
 *   3. No requirement to upload a contact list. Recipients go one at a time,
 *      at send time. A provider holding a mirror of the CRM is a second copy
 *      of the thing §3 is careful about, outside our retention rules and
 *      outside our burn switch.
 */

import type { Env } from '../env';

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
  /** Rendered into the footer. Required — see assertUnsubscribable below. */
  unsubscribeUrl: string;
}

export interface OutboundSms {
  to: string;
  body: string;
  /** The number this goes out from. P2P throttling is per sender. */
  fromSender: string;
}

export type SendResult =
  | { ok: true; providerId?: string }
  | { ok: false; kind: 'rejected' | 'invalid_address' | 'rate_limited' | 'provider_error'; detail?: string };

export interface Sender {
  email(message: OutboundEmail): Promise<SendResult>;
  sms(message: OutboundSms): Promise<SendResult>;
}

/**
 * Every bulk email carries a working unsubscribe link. Enforced here rather
 * than trusted to the composer, because §5.4 admits no exceptions and "this one
 * is transactional" is exactly how the first one gets sent without.
 */
export function assertUnsubscribable(message: OutboundEmail): void {
  if (!message.unsubscribeUrl) {
    throw new Error('Refusing to send an email with no unsubscribe link (§5.4).');
  }
}

/**
 * The default. Fails every send with a clear reason.
 *
 * Deliberately not a no-op that reports success: a stub that pretends to
 * deliver would leave a campaign showing "sent" to an organizer whose members
 * heard nothing, which is worse than an outage because nobody investigates it.
 */
class UnconfiguredSender implements Sender {
  private fail(): SendResult {
    return {
      ok: false,
      kind: 'provider_error',
      detail: 'No delivery provider is configured. See src/worker/lib/sender.ts.',
    };
  }

  async email(message: OutboundEmail): Promise<SendResult> {
    assertUnsubscribable(message);
    return this.fail();
  }

  async sms(): Promise<SendResult> {
    return this.fail();
  }
}

export function getSender(_env: Env): Sender {
  return new UnconfiguredSender();
}

// ---------------------------------------------------------------------------
// Merge fields
// ---------------------------------------------------------------------------

/** Fields a composer may reference. A closed list, so a typo cannot leak a column. */
export const MERGE_FIELDS = ['display_name', 'first_name', 'postal_code'] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

export interface MergeSource {
  display_name: string;
  postal_code?: string | null;
}

/**
 * Expand `{{display_name}}` style placeholders.
 *
 * An unknown placeholder is left as written rather than replaced with an empty
 * string. "Hi {{frist_name}}," going out to four thousand people is a bad day;
 * "Hi ," going out to four thousand people is a worse one, because nobody
 * notices before it sends.
 */
export function renderMergeFields(template: string, contact: MergeSource): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, field: string) => {
    switch (field) {
      case 'display_name':
        return contact.display_name;
      case 'first_name':
        // Best effort, and it will be wrong for some names. That is why the
        // composer's help text steers people toward display_name.
        return contact.display_name.trim().split(/\s+/)[0] ?? contact.display_name;
      case 'postal_code':
        return contact.postal_code ?? '';
      default:
        return whole;
    }
  });
}

/** Placeholders in a template that are not in MERGE_FIELDS, for the composer to warn on. */
export function unknownMergeFields(template: string): string[] {
  const found = [...template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((f) => !MERGE_FIELDS.includes(f as MergeField)))];
}
