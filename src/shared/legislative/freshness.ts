/**
 * When this field guide stops being trustworthy, and what to say then.
 *
 * The research behind `PATHWAYS` was done in July 2026. Some of it is durable —
 * whether a state has an initiative at all changes once a decade. The signature
 * counts are not: most are a percentage of votes cast at the last qualifying
 * election, so on the night of the next one they are simply wrong, everywhere at
 * once, with no error and nothing to notice.
 *
 * That is the failure this file exists to prevent, and it is the one that costs
 * a group a campaign rather than an afternoon.
 *
 * ---------------------------------------------------------------------------
 * Why one global date rather than a per-state model
 * ---------------------------------------------------------------------------
 *
 * The honest version of a per-state model needs each state's qualifying
 * election cycle — gubernatorial for most, total general-election turnout in
 * Wyoming, presidential in Florida, the decennial census in North Dakota, and
 * live voter registration in Nebraska and DC. New Jersey and Virginia elect
 * governors in odd years; New Hampshire and Vermont every two.
 *
 * I tried to derive it from the research prose and it does not survive contact:
 * scanning the signature blocks for a year returns 2016 for Colorado and 2014
 * for Maine, both incidental mentions rather than basis elections. That is the
 * same mistake as inferring "no knowable count" from phrasing — which missed
 * Nebraska — so it is not repeated here.
 *
 * A single date is cruder and it fails in the safe direction: after it, every
 * count is reported as needing verification, including the ones that did not
 * change. Over-warning costs a phone call to a Secretary of State. Under-warning
 * costs a year of signature gathering against the wrong target.
 */

import { PATHWAYS, pathwayFor } from './index';
import type { CountKind, Pathway } from './types';

/**
 * The next US general election after the research was done.
 *
 * Most initiative thresholds are recomputed from it. Not a guess at when each
 * state publishes its new figure — states take weeks to months — but the date
 * after which our numbers are no longer the current ones.
 */
export const RESET_AFTER = '2026-11-03';

/** When the research itself was done. Every record carries the same value. */
export const RESEARCHED = '2026-07';

export type Freshness = 'current' | 'needs_verification' | 'never_expires' | 'unverified';

export interface FreshnessVerdict {
  state: Freshness;
  /** Said to the organizer. Never "data may be stale". */
  message: string;
  /** Where to go and check. The state's own page, from the record. */
  source: string | null;
}

function asOfDate(now: Date): boolean {
  return now >= new Date(`${RESET_AFTER}T00:00:00Z`);
}

/**
 * Whether a jurisdiction's signature figure can still be relied on.
 *
 * `now` is injectable because the whole point of this module is behaviour that
 * changes on a date, and a test that cannot move the clock cannot check it.
 */
export function freshnessFor(code: string, now: Date = new Date()): FreshnessVerdict | null {
  const pathway = pathwayFor(code);
  if (!pathway) return null;
  return verdictFor(pathway, now);
}

export function verdictFor(pathway: Pathway, now: Date = new Date()): FreshnessVerdict {
  const source = pathway.sources.signatures ?? pathway.sources.initiative;

  /*
   * Nebraska and DC never go stale, because they never had a number to go stale.
   * Both peg the threshold to voter registration on a future date, so the answer
   * has always been "use the formula and check the live figure" — an election
   * changes nothing about that instruction.
   */
  if (pathway.statuteCountKind === 'unknowable') {
    return {
      state: 'never_expires',
      message:
        `${pathway.name} has no fixed threshold to go out of date — it is a share of voter ` +
        `registration measured on a future date. Work from the formula and the current ` +
        `registration figure.`,
      source,
    };
  }

  if (pathway.statuteCountKind === 'unverified') {
    return {
      state: 'unverified',
      message:
        `We could not verify ${pathway.name}'s figure from an official source when this was ` +
        `researched, and that has not changed. Confirm it with the state before gathering.`,
      source,
    };
  }

  if (pathway.statuteCountKind === 'none') {
    return {
      state: 'never_expires',
      message: `${pathway.name} has no citizen statutory initiative, which is not something an election changes.`,
      source,
    };
  }

  if (asOfDate(now)) {
    return {
      state: 'needs_verification',
      message:
        `This figure comes from research done in ${RESEARCHED} and the ${RESET_AFTER} general ` +
        `election has since been held. Most states recompute the threshold from the most recent ` +
        `qualifying election, so treat this as a starting point and confirm it with ` +
        `${pathway.name} before gathering a single signature.`,
      source,
    };
  }

  return {
    state: 'current',
    message:
      `Researched ${RESEARCHED} and current until the ${RESET_AFTER} general election, after ` +
      `which most states recompute it.`,
    source,
  };
}

/**
 * Every URL the field guide would send an organizer to.
 *
 * Used by the link checker. Pennsylvania's drafting manual was deleted in May
 * 2026 and reads "{Reserved}" — nine weeks before this research ran. A published
 * field guide that keeps linking to it is worse than one with a gap, because the
 * gap is honest.
 */
export function allLinks(): Array<{ code: string; field: string; url: string }> {
  const links: Array<{ code: string; field: string; url: string }> = [];
  for (const p of PATHWAYS) {
    if (p.manualUrl) links.push({ code: p.code, field: 'manualUrl', url: p.manualUrl });
    for (const [field, url] of Object.entries(p.sources)) {
      if (url) links.push({ code: p.code, field: `sources.${field}`, url });
    }
  }
  return links;
}

/** Counts by freshness state, for /trust and for an ops check. */
export function freshnessSummary(now: Date = new Date()): Record<Freshness, number> {
  const summary: Record<Freshness, number> = {
    current: 0,
    needs_verification: 0,
    never_expires: 0,
    unverified: 0,
  };
  for (const p of PATHWAYS) summary[verdictFor(p, now).state] += 1;
  return summary;
}

/** Re-exported so callers do not have to reach into two modules for one answer. */
export type { CountKind };
