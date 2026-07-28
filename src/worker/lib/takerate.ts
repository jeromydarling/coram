/**
 * takerate — the platform's cut, and the two places it is zero.
 *
 * §5.6: "1% platform take on general fundraising and dues. Zero on bail and
 * mutual aid. This waiver is a permanent product commitment. Do not make it
 * configurable."
 *
 * §10: "Do not soften the bail-fund waiver, the free tier, or the burn switch
 * in response to revenue modeling. They are load-bearing for trust."
 *
 * So: no environment variable, no tenant setting, no database column, and no
 * argument to override. This module exports a pure function over a frozen
 * table, and the authoritative copy is coram.take_basis_points() in
 * migrations/0005_thesaurus.sql — a trigger computes every fee there and
 * discards whatever the application supplied. This file exists so the product
 * can quote a fee before charging one, and the test beside it exists so the
 * two copies cannot drift apart quietly.
 *
 * If you are here to add a parameter, that is the change §10 is about.
 */

export type FundKind = 'general' | 'dues' | 'mutual_aid' | 'bail';

/** Basis points. 100 bp = 1%. */
export const TAKE_BASIS_POINTS: Readonly<Record<FundKind, number>> = Object.freeze({
  general: 100,
  dues: 100,
  mutual_aid: 0,
  bail: 0,
});

/** The kinds that are, and always will be, free to use. */
export const WAIVED_KINDS: readonly FundKind[] = Object.freeze(['mutual_aid', 'bail']);

export function takeBasisPoints(kind: FundKind): number {
  return TAKE_BASIS_POINTS[kind];
}

/**
 * The platform's cut of one contribution, in minor units.
 *
 * Integer arithmetic and truncating division, matching the SQL exactly. Both
 * round in the group's favour: a $10.005 fee is charged as $10.00, never
 * rounded up. Over a year of small donations that difference is real money,
 * and it should fall on our side.
 */
export function takeCents(amountCents: number, kind: FundKind): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new RangeError('Contribution amounts are non-negative integer minor units.');
  }
  return Math.floor((amountCents * takeBasisPoints(kind)) / 10_000);
}

/** What reaches the group. */
export function netCents(amountCents: number, kind: FundKind): number {
  return amountCents - takeCents(amountCents, kind);
}

export function isWaived(kind: FundKind): boolean {
  return takeBasisPoints(kind) === 0;
}

/**
 * Wording for the point of donation, so a giver can see the split before they
 * give rather than discovering it on a receipt.
 */
export function describeTake(kind: FundKind): string {
  return isWaived(kind)
    ? 'Every penny goes to the fund. Coram takes nothing from bail and mutual aid.'
    : 'Coram keeps 1% to run the platform. The rest goes to the group.';
}
