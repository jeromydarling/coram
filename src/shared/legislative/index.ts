/**
 * Which route a group actually has, in their jurisdiction.
 *
 * The brief that prompted this feature assumes a group picks one of three
 * pathways. The research says most groups have fewer choices than that: 29 of
 * 51 jurisdictions have no citizen statutory initiative at all, and 6 more have
 * only an indirect one. So the primary function here is not "show me the
 * initiative rules" — it is `routesFor`, which answers the question a first-time
 * organizer is actually asking: *what can we do from here?*
 */

import { PATHWAYS } from './pathways.generated';
import type { CountKind, Pathway } from './types';

export type { CountKind, InitiativeRoute, Pathway } from './types';
export { PATHWAYS };

const BY_CODE = new Map(PATHWAYS.map((p) => [p.code, p]));

export function pathwayFor(code: string): Pathway | null {
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

export type RouteKind = 'initiative' | 'indirect-initiative' | 'referendum' | 'local' | 'sponsor';

export interface Route {
  kind: RouteKind;
  /** Shown as the route's heading. Plain, no hedging. */
  title: string;
  /** Why this route and not another. One or two sentences, in product voice. */
  detail: string;
  /**
   * The state's own drafting office will help with *this* route, and what the
   * conditions are — verbatim research prose, so a UI renders it as a quoted
   * note rather than as our own copy.
   *
   * Attached to a route rather than to the jurisdiction because the offer is
   * narrower than it first appears. California, Washington, South Dakota and
   * Wyoming all answer "can a citizen get a draft?" with yes, and in all four
   * the yes applies to initiative proponents only — the Code Reviser and the
   * Legislative Service Office draft ordinary bills for legislators and
   * committees, not for the public. An earlier version of this function put
   * "the state will write the bill for you" on the sponsor route in all four,
   * which was flatly wrong and would have sent people to an office that would
   * turn them away.
   */
  draftingHelp: string | null;
  /**
   * Ordered by what a group should try first. The sponsor route is always
   * present and always last — it is the only one available everywhere, and it
   * is the one the brief is right that most people misunderstand.
   */
  rank: number;
}

/**
 * Every route open to a group in this jurisdiction, best first.
 *
 * Local comes before the statewide initiative deliberately. For Coram's users
 * a municipal ordinance is usually the fastest real win — lower thresholds,
 * a result inside one cycle rather than five — and in the 29 jurisdictions with
 * no statewide initiative it is the only citizen-initiated route that exists.
 * The brief lists it third; the data says it should lead.
 */
export function routesFor(code: string): Route[] {
  const p = pathwayFor(code);
  if (!p) return [];

  const routes: Route[] = [];

  // Where the state drafts for citizens at all, it is for initiative
  // proponents. See Route.draftingHelp.
  const initiativeHelp = p.canRequestDraft === true ? p.citizenRouteNotes : null;

  if (p.localInitiative !== false) {
    routes.push({
      kind: 'local',
      title: 'A city or county ordinance',
      detail:
        p.localInitiative === null
          ? `In ${p.name} this depends on your municipality's charter rather than state law, so it has to be checked locally. Where it exists it is usually the fastest route.`
          : 'Usually the fastest route: lower thresholds, and a result inside one cycle rather than five.',
      draftingHelp: null,
      rank: 1,
    });
  }

  if (p.statute === 'direct') {
    routes.push({
      kind: 'initiative',
      title: 'A statewide ballot initiative',
      detail: `${p.name} lets a qualified petition go straight to the ballot.`,
      draftingHelp: initiativeHelp,
      rank: 2,
    });
  } else if (p.statute === 'indirect') {
    routes.push({
      kind: 'indirect-initiative',
      title: 'An initiative to the legislature',
      detail:
        `In ${p.name} a qualified petition goes to the legislature first, and only reaches the ` +
        `ballot if they decline to act. Your audience is a few hundred legislators before it is ` +
        `a few hundred thousand voters, and that changes the whole campaign.`,
      draftingHelp: initiativeHelp,
      rank: 2,
    });
  }

  if (p.referendum && p.statute === 'none') {
    routes.push({
      kind: 'referendum',
      title: 'A veto referendum on a law already passed',
      detail:
        `${p.name} has no initiative, so citizens cannot put a new law on the ballot. What you ` +
        `can do is overturn one the legislature has already passed — a different campaign, on ` +
        `the legislature's clock rather than yours.`,
      draftingHelp: null,
      rank: 3,
    });
  }

  /*
   * Always last, always present, and never claiming the state will help.
   *
   * Every drafting office in this dataset drafts ordinary bills for legislators
   * and committees only. For this route the honest answer everywhere is the
   * same: you write it, a member files it.
   */
  routes.push({
    kind: 'sponsor',
    title: 'A bill carried by a legislator',
    detail: 'Available everywhere. You write the draft; only a sitting member can file it.',
    draftingHelp: null,
    rank: 4,
  });

  return routes.sort((a, b) => a.rank - b.rank);
}

export interface SignatureTarget {
  kind: CountKind;
  count: number | null;
  formula: string | null;
  /** Present whenever the statewide number is not the operative constraint. */
  distribution: string | null;
  /** What to tell the organizer. Never a bare number when a bare number lies. */
  guidance: string;
  source: string | null;
}

/**
 * What to put in front of someone about to gather signatures.
 *
 * This deliberately does not return a number on its own, because in several
 * states a number on its own is false. Wyoming's statewide requirement is
 * 40,669 and its binding constraint is 15% of turnout in 16 of 23 counties,
 * where the cheapest sixteen already exceed the statewide total — a group
 * filling a progress bar to 40,669 would have measured the wrong thing for the
 * entire campaign. Nebraska and DC have no knowable number at all.
 */
export function signatureTarget(code: string): SignatureTarget | null {
  const p = pathwayFor(code);
  if (!p) return null;

  const base: Omit<SignatureTarget, 'guidance'> = {
    kind: p.statuteCountKind,
    count: p.statuteCount,
    formula: p.statuteFormula,
    distribution: p.distribution,
    source: p.sources.signatures,
  };

  if (p.statute === 'none') {
    return {
      ...base,
      guidance: `${p.name} has no citizen statutory initiative. There is no signature target because there is no petition to file.`,
    };
  }

  if (p.statuteCountKind === 'unknowable') {
    return {
      ...base,
      guidance:
        `${p.name} sets its threshold against voter registration on a future date, so no target ` +
        `exists yet. Work from the formula and check the current registration figure with the ` +
        `state before you plan a field operation.`,
    };
  }

  if (p.statuteCountKind === 'unverified') {
    return {
      ...base,
      guidance:
        `We could not verify ${p.name}'s current figure from an official source. Confirm it with ` +
        `the state before gathering anything — this is the number that decides the campaign.`,
    };
  }

  const target = p.statuteCount!.toLocaleString('en-US');
  if (p.distribution) {
    return {
      ...base,
      guidance:
        `${target} statewide — and that is not the constraint that will decide this. ` +
        `${p.name} also requires signatures spread across specific counties or districts, and ` +
        `campaigns fail on the distribution rule far more often than on the total.`,
    };
  }

  return {
    ...base,
    guidance: `${target} signatures, valid until the election the figure is based on is re-run.`,
  };
}

/** Jurisdictions where the state will draft the bill for you. */
export function draftingOffices(): Pathway[] {
  return PATHWAYS.filter((p) => p.canRequestDraft === true);
}
