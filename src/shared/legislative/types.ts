/**
 * How citizen-drafted legislation actually reaches a legislature, per
 * jurisdiction. Backs the guided pipeline in Petitio (§5.5).
 *
 * The shape of this file is an argument with the brief that prompted it. That
 * brief presents three clean pathways — federal sponsor, state ballot
 * initiative, local ordinance — as though a group picks one. The research says
 * otherwise: of 51 jurisdictions, 29 have no citizen statutory initiative at
 * all, and 6 more have only an indirect one where a successful petition goes to
 * the legislature rather than the ballot. For most organizers in most states
 * the initiative is not a pathway, and a product that offers it as a default
 * would be sending people down a road that does not exist where they live.
 *
 * So the type makes absence explicit and typed rather than leaving it to a
 * null: `none` is a finding, not a missing value.
 */

/**
 * Direct: a qualified petition goes to the ballot.
 * Indirect: it goes to the legislature first, and reaches the ballot only if
 *   the legislature declines. Maine, Massachusetts, Michigan, Nevada, Ohio,
 *   Alaska and Washington's second route work this way, and the strategy is
 *   completely different — the campaign's audience is 150 legislators before
 *   it is a million voters.
 * None: the mechanism does not exist in this jurisdiction.
 */
export type InitiativeRoute = 'direct' | 'indirect' | 'none';

/**
 * Why a signature count is absent, which the UI must distinguish because the
 * two absences call for opposite instructions.
 *
 * fixed       a real number, valid until its base election is re-run
 * unknowable  no number can exist yet — Nebraska and DC peg the threshold to
 *             voter registration at a future date, so the answer is a formula
 *             and a live lookup, never a target
 * unverified  a number exists but we could not source it; go and check
 * none        the mechanism does not exist, so there is nothing to count
 */
export type CountKind = 'fixed' | 'unknowable' | 'unverified' | 'none';

export interface PathwaySources {
  initiative: string | null;
  signatures: string | null;
  drafting: string | null;
  local: string | null;
  citizenRoute: string | null;
}

export interface Pathway {
  /** USPS code. DC is included; the territories are not, yet. */
  code: string;
  name: string;
  /** When the research was done. Signature counts go stale on election night. */
  asOf: string;

  statute: InitiativeRoute;
  constitutional: InitiativeRoute;
  /** A veto referendum overturns a law already passed. Different mechanism. */
  referendum: boolean;

  statuteCount: number | null;
  statuteCountKind: CountKind;
  /**
   * Why no number can exist, where that is the case. Null everywhere else.
   *
   * Carried so the UI can say *why* it is showing a formula instead of a
   * target. "We don't know" and "nobody can know yet" call for opposite
   * actions from an organizer, and only one of them means go and check.
   */
  countUnknowableBecause: string | null;
  statuteFormula: string | null;
  constitutionalCount: number | null;
  constitutionalFormula: string | null;
  /**
   * Maryland and Kentucky have no initiative at all — a referendum is their
   * only citizen mechanism. Kept in its own field because putting it in
   * statuteCount would hand a group the target for a campaign it is not
   * running: enough to overturn a law, not enough to pass one.
   */
  referendumCount: number | null;
  referendumFormula: string | null;

  /**
   * Geographic distribution requirement, verbatim, or null.
   *
   * Not a boolean, because in several states this is the whole campaign rather
   * than a qualifier on it. Wyoming requires 15% of turnout in 16 of 23
   * counties and the cheapest sixteen already exceed the statewide total, so
   * the statewide figure is close to meaningless on its own. Arkansas needs 50
   * of 75 counties, Utah 26 of 29 senate districts, Nebraska 38 of 93.
   */
  distribution: string | null;

  circulationDays: number | null;
  filingDeadline: string | null;
  subjectLimits: readonly string[];
  preFilingReview: string | null;

  /** null where it depends on an individual municipal charter. */
  localInitiative: boolean | null;
  localNotes: string | null;

  /** Verified to resolve at research time. Null where the state publishes none. */
  manualUrl: string | null;
  manualName: string | null;
  enactingClause: string | null;
  requiredSections: readonly string[];

  /**
   * Whether a member of the public can ask the state's drafting office to write
   * the bill. California will, free, for a request signed by 25 electors
   * (Gov. Code § 10243) — which is the single most useful fact in this dataset
   * for a Californian, and belongs in front of them before they write a word.
   */
  canRequestDraft: boolean | null;
  citizenRouteNotes: string | null;

  sources: PathwaySources;
  /** What could not be verified. Shipped, not hidden. */
  gaps: readonly string[];
}
