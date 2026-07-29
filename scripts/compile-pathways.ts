/**
 * Compile the state research into a runtime module.
 *
 * research/legislative/states/*.json is 477 KB of prose, sources, and the
 * reasoning behind each finding. That is the provenance record and it stays out
 * of the Worker. What ships is the subset a guided pipeline actually branches
 * on, plus every source URL — because a number an organizer cannot check is a
 * number they have to take on faith, and this research exists precisely because
 * numbers from unchecked sources are wrong often enough to cost a campaign.
 *
 * Run: npx tsx scripts/compile-pathways.ts
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'research/legislative/states';
const OUT = 'src/shared/legislative/pathways.generated.ts';

interface Raw {
  code: string;
  name: string;
  asOf: string;
  initiative: {
    statute: string;
    constitutional: string;
    referendum: boolean;
    signatures: {
      statuteFormula: string | null;
      statuteCount: number | null;
      constitutionalFormula: string | null;
      constitutionalCount: number | null;
      referendumFormula?: string | null;
      referendumCount?: number | null;
      distribution: string | null;
      source: string | null;
    };
    circulationDays: number | null;
    filingDeadline: string | null;
    subjectLimits: string[] | null;
    preFilingReview: string | null;
    source: string | null;
  };
  localOrdinance: { citizenInitiative: boolean | null; notes: string | null; source: string | null };
  drafting: {
    manualUrl: string | null;
    manualName: string | null;
    enactingClause: string | null;
    requiredSections: string[] | null;
    source: string | null;
  };
  legislature: Record<string, unknown>;
  citizenRoute: { canRequestDraft: boolean | null; notes: string | null; source: string | null };
  gaps: string[];
}

/*
 * Why a count is absent matters more than the fact that it is. Nebraska and DC
 * peg their thresholds to voter registration at a future date, so no number
 * exists to publish — the UI must show a formula and send the organizer to a
 * live lookup. That is the opposite instruction from "we could not verify
 * this", which means go and check. Collapsing both to null would make the
 * product give the wrong advice in two jurisdictions.
 *
 * Explicit, not inferred.
 *
 * The first version of this matched phrases like "registered voters at" against
 * the formula text, and it missed Nebraska — whose record says "registered
 * voters of the state ... measured at the petition filing deadline", which is
 * the same fact in different words. Eleven agents wrote this prose and they did
 * not agree on phrasing, so a regex over it will keep being wrong in ways that
 * are invisible until a Nebraskan is shown a target that cannot exist.
 *
 * Two jurisdictions. A list is cheaper than a clever rule, and the test
 * asserts the list against every record with a null count.
 */
const UNKNOWABLE: Record<string, string> = {
  NE: 'Threshold is 7% of registered voters measured at the filing deadline, so it moves with registration until the moment it closes.',
  DC: 'Threshold is pegged to the registration count 30 days before submission.',
};

function countKind(code: string, count: number | null, formula: string | null): string {
  if (count !== null) return 'fixed';
  if (code in UNKNOWABLE) return 'unknowable';
  if (!formula) return 'none';
  return 'unverified';
}

/**
 * Strip artefacts of how the research was batched.
 *
 * The states were researched in ten groups of five, and two records open with a
 * sentence comparing their state to the others in their own batch —
 * "CALIFORNIA IS THE STRONGEST CITIZEN-DRAFTING ROUTE OF THESE FIVE STATES",
 * "West Virginia is the friendliest of these five states". Those are notes from
 * one researcher to the next. To a user they are meaningless: there is no
 * "these five states" in the product, and a shouted comparison to an invisible
 * cohort reads as a bug.
 *
 * Caught because it reached a live response before any test looked at it — the
 * copy test covered our own prose and not the quoted kind.
 */
function stripBatchArtefacts(note: string | null): string | null {
  if (!note) return null;
  const sentences = note.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (s) => !/\b(these five states|of the five|this batch)\b/i.test(s),
  );
  const text = kept.join(' ').trim();
  return text === '' ? null : text;
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.json')).sort();
const records = files.map((f) => JSON.parse(readFileSync(join(SRC, f), 'utf8')) as Raw);

const entries = records.map((r) => {
  const s = r.initiative.signatures;
  return {
    code: r.code,
    name: r.name,
    asOf: r.asOf,
    statute: r.initiative.statute,
    constitutional: r.initiative.constitutional,
    referendum: r.initiative.referendum,
    statuteCount: s.statuteCount,
    statuteCountKind: countKind(r.code, s.statuteCount, s.statuteFormula),
    countUnknowableBecause: UNKNOWABLE[r.code] ?? null,
    statuteFormula: s.statuteFormula,
    constitutionalCount: s.constitutionalCount,
    constitutionalFormula: s.constitutionalFormula,
    referendumCount: s.referendumCount ?? null,
    referendumFormula: s.referendumFormula ?? null,
    /*
     * Carried as a string rather than a boolean because in several states it is
     * THE binding constraint, not a footnote. Wyoming needs 15% in 16 of 23
     * counties and the cheapest sixteen already exceed the statewide total; a
     * group shown only "40,669" is measuring the wrong thing for the whole
     * campaign.
     */
    distribution: s.distribution,
    circulationDays: r.initiative.circulationDays,
    filingDeadline: r.initiative.filingDeadline,
    subjectLimits: r.initiative.subjectLimits ?? [],
    preFilingReview: r.initiative.preFilingReview,
    localInitiative: r.localOrdinance.citizenInitiative,
    localNotes: stripBatchArtefacts(r.localOrdinance.notes),
    manualUrl: r.drafting.manualUrl,
    manualName: r.drafting.manualName,
    enactingClause: r.drafting.enactingClause,
    requiredSections: r.drafting.requiredSections ?? [],
    canRequestDraft: r.citizenRoute.canRequestDraft,
    citizenRouteNotes: stripBatchArtefacts(r.citizenRoute.notes),
    sources: {
      initiative: r.initiative.source,
      signatures: s.source,
      drafting: r.drafting.source,
      local: r.localOrdinance.source,
      citizenRoute: r.citizenRoute.source,
    },
    gaps: r.gaps,
  };
});

const banner = `/**
 * GENERATED — do not edit. Run \`npx tsx scripts/compile-pathways.ts\`.
 *
 * Source: research/legislative/states/*.json, researched ${records[0].asOf}.
 *
 * Every jurisdiction carries its own source URLs and its own list of what could
 * not be verified. Both ship, because the failure this data exists to prevent
 * is an organizer gathering signatures against a number that moved.
 */

import type { Pathway } from './types';

export const PATHWAYS: readonly Pathway[] = ${JSON.stringify(entries, null, 2)} as const;
`;

writeFileSync(OUT, banner);

const kinds = entries.reduce<Record<string, number>>((a, e) => {
  a[e.statute] = (a[e.statute] ?? 0) + 1;
  return a;
}, {});
console.log(`Wrote ${OUT}: ${entries.length} jurisdictions.`);
console.log('Statutory initiative:', kinds);
console.log('Unknowable counts:', entries.filter((e) => e.statuteCountKind === 'unknowable').map((e) => e.code));
console.log('No drafting manual:', entries.filter((e) => !e.manualUrl).map((e) => e.code).join(' '));
