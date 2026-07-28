/**
 * suppression — the hashing side of the opt-out ledger (§5.4).
 *
 * The ledger stores HMAC-SHA256(pepper, "<channel>:<normalized identifier>").
 * The pepper is a Worker secret and is never written to Postgres, so a
 * database disclosure cannot test whether a given address is suppressed.
 *
 * Normalization is the part that decides whether this works at all. If the
 * same person's address hashes two different ways depending on which code path
 * wrote it, the ledger silently fails open and someone who unsubscribed gets
 * mailed anyway. Every hash in the product goes through the functions below,
 * and nothing else may compute one.
 */

import type { Env } from '../env';

export type Channel = 'email' | 'sms' | 'phone' | 'all';

const enc = new TextEncoder();

/**
 * Email: lowercase and trim. Deliberately no gmail dot-stripping or plus-tag
 * removal — those are provider-specific guesses, and getting them wrong in the
 * *other* direction would suppress an address the person never opted out.
 * Over-suppressing a stranger is worse than under-suppressing a tag.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Phone: keep the digits and a leading +. "(555) 013-4" and "+15550134" are the
 * same phone, and a ledger that treats them as different numbers is a ledger
 * that lets you text someone who told you to stop.
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * The one function permitted to produce a ledger hash.
 *
 * The hashed input is prefixed with a *label*, not with the caller's channel,
 * and 'sms' and 'phone' share the label `tel`. That matters: a do-not-call
 * recorded by the phone bank has to stop a text too, and it can only do that
 * if both look up the same stored hash. Collapsing them here means no caller
 * can get it wrong — there is no combination of arguments that produces two
 * different hashes for one phone number.
 *
 * The label is still part of the input so an email hash can never collide with
 * a phone hash, even if the normalized strings happened to match.
 */
export async function hashIdentifier(
  env: Env,
  channel: Exclude<Channel, 'all'>,
  identifier: string,
): Promise<string> {
  const isEmail = channel === 'email';
  const label = isEmail ? 'email' : 'tel';
  const normalized = isEmail ? normalizeEmail(identifier) : normalizePhone(identifier);
  if (!normalized) throw new Error('Refusing to hash an empty identifier.');

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(env.SUPPRESSION_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(`${label}:${normalized}`));

  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The pair of hashes stored on a contact row, so the database can enforce
 * suppression from the contact itself rather than from anything a caller
 * passed in. See the trigger in migrations/0004_nuntius.sql.
 */
export async function contactHashes(
  env: Env,
  contact: { email?: string | null; phone?: string | null },
): Promise<{ emailHash: string | null; phoneHash: string | null }> {
  const [emailHash, phoneHash] = await Promise.all([
    contact.email ? hashIdentifier(env, 'email', contact.email) : Promise.resolve(null),
    contact.phone ? hashIdentifier(env, 'sms', contact.phone) : Promise.resolve(null),
  ]);
  return { emailHash, phoneHash };
}

