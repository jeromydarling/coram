/**
 * redact — nothing personal reaches a model endpoint (§5.10, §3.8).
 *
 * §3.8: "Redaction before inference. No PII may leave the Worker toward any
 * model endpoint. Redact server-side, dispatch, reinsert client-side."
 * §5.10 requires this file to exist before any Scriba route does.
 *
 * Two passes, because either alone is inadequate:
 *
 *   1. **Known values.** The workspace's own contact names, emails, phones and
 *      postcodes, supplied by the caller and matched exactly. This is what
 *      actually catches names — no regex finds "Ada Okonkwo" in prose, but a
 *      list of the people this workspace organizes with does.
 *
 *   2. **Patterns.** Emails, phone numbers, postcodes, and government
 *      identifiers in any shape, whether or not we have seen them before. This
 *      catches what a member typed that is not in the CRM.
 *
 * Placeholders are stable within one call, so "Ada" appearing four times
 * becomes `[PERSON_1]` four times and the model can still reason about the
 * text. They are *not* stable across calls: the same person is a different
 * number in a different request, so an endpoint that logged everything could
 * not correlate two conversations about the same person.
 *
 * ---------------------------------------------------------------------------
 * The limit, stated rather than implied: this cannot find a name it has never
 * been given. A nickname, a misspelling, a person mentioned who is not in the
 * CRM — none of those match pass 1, and no pattern catches them. `residualRisk`
 * reports what could not be checked, and the Scriba UI shows the redacted text
 * before dispatch so a human sees exactly what is about to leave. That review
 * step is part of the mechanism, not a nicety.
 * ---------------------------------------------------------------------------
 */

export type PiiKind = 'PERSON' | 'EMAIL' | 'PHONE' | 'POSTCODE' | 'GOV_ID' | 'CARD';

export interface RedactionMap {
  /** placeholder -> original. Never sent to a model. */
  [placeholder: string]: string;
}

export interface Redacted {
  text: string;
  map: RedactionMap;
  /** Counts by kind, for showing the user what was removed. */
  removed: Record<PiiKind, number>;
}

export interface KnownValues {
  names?: string[];
  emails?: string[];
  phones?: string[];
  postalCodes?: string[];
}

/**
 * Patterns applied after known values.
 *
 * Deliberately greedy. A false positive costs a slightly less useful prompt; a
 * false negative sends someone's phone number to a third party, and those are
 * not the same size of mistake.
 */
const PATTERNS: Array<{ kind: PiiKind; re: RegExp }> = [
  { kind: 'EMAIL', re: /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi },
  // US SSN and similar 3-2-4 groupings. Before phone, which would otherwise
  // swallow it.
  { kind: 'GOV_ID', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'CARD', re: /\b(?:\d[ -]?){13,19}\b/g },
  // International and domestic phone shapes. Requires punctuation or a country
  // code so it does not eat every long number.
  { kind: 'PHONE', re: /(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  { kind: 'PHONE', re: /\+\d{7,15}\b/g },
  // US ZIP and UK-style postcodes.
  { kind: 'POSTCODE', re: /\b\d{5}(-\d{4})?\b/g },
  { kind: 'POSTCODE', re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi },
];

/**
 * Remove everything personal from `text`.
 *
 * Known values are matched first and longest-first, so "Ada Okonkwo" is one
 * `[PERSON_1]` rather than two placeholders that a model might read as two
 * people.
 */
export function redact(text: string, known: KnownValues = {}): Redacted {
  interface Match {
    start: number;
    end: number;
    value: string;
    kind: PiiKind;
    /** Lower wins a tie. Patterns beat known values — see below. */
    precedence: number;
  }

  const found: Match[] = [];

  /*
   * Patterns are collected first and take precedence on overlap.
   *
   * That ordering is not cosmetic. A roster containing "Ada" would otherwise
   * match the "ada" inside "ada@example.org", leaving `[PERSON_1]@example.org`
   * — an email that survives redaction in pieces, and a round-trip that comes
   * back with the wrong capitalisation. Letting the EMAIL match own that span
   * keeps whole structured values whole.
   */
  for (const { kind, re } of PATTERNS) {
    for (const match of text.matchAll(new RegExp(re.source, re.flags))) {
      if (match.index === undefined) continue;
      found.push({
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        kind,
        precedence: 0,
      });
    }
  }

  // Known values, longest first so "Ada Okonkwo" beats "Ada" — two placeholders
  // where there is one person reads to a model as two people.
  const knownEntries: Array<[string, PiiKind]> = [
    ...(known.names ?? []).map((v) => [v, 'PERSON'] as [string, PiiKind]),
    ...(known.emails ?? []).map((v) => [v, 'EMAIL'] as [string, PiiKind]),
    ...(known.phones ?? []).map((v) => [v, 'PHONE'] as [string, PiiKind]),
    ...(known.postalCodes ?? []).map((v) => [v, 'POSTCODE'] as [string, PiiKind]),
  ]
    .filter(([v]) => v && v.trim().length >= 2)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [value, kind] of knownEntries) {
    const pattern = new RegExp(`(?<![\\w@.])(${escapeRegExp(value.trim())})(?![\\w@.])`, 'gi');
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      found.push({
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        kind,
        precedence: 1,
      });
    }
  }

  // Resolve overlaps: earliest start wins, then longest, then precedence.
  found.sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.precedence - b.precedence,
  );

  const kept: Match[] = [];
  let consumedTo = -1;
  for (const match of found) {
    if (match.start < consumedTo) continue;
    kept.push(match);
    consumedTo = match.end;
  }

  /*
   * Placeholders are numbered in order of first appearance in the text, not in
   * the order the caller happened to list the roster. Two consequences worth
   * knowing: the numbering is stable within a call, so a model can tell one
   * person from another; and it carries no information derived from our own
   * identifiers, because it is an ordinal over this text and nothing else.
   */
  const map: RedactionMap = {};
  const removed: Record<PiiKind, number> = {
    PERSON: 0, EMAIL: 0, PHONE: 0, POSTCODE: 0, GOV_ID: 0, CARD: 0,
  };
  const counters: Record<PiiKind, number> = { ...removed };
  const assigned = new Map<string, string>();

  const pieces: string[] = [];
  let cursor = 0;

  for (const match of kept) {
    pieces.push(text.slice(cursor, match.start));

    const key = `${match.kind}:${match.value.toLowerCase()}`;
    let placeholder = assigned.get(key);
    if (!placeholder) {
      counters[match.kind] += 1;
      removed[match.kind] += 1;
      placeholder = `[${match.kind}_${counters[match.kind]}]`;
      assigned.set(key, placeholder);
      map[placeholder] = match.value;
    }

    pieces.push(placeholder);
    cursor = match.end;
  }
  pieces.push(text.slice(cursor));

  return { text: pieces.join(''), map, removed };
}

/**
 * Put the real values back. Runs in the browser (§3.8) — the mapping goes to
 * the client with the response and never to the model.
 */
export function reinsert(text: string, map: RedactionMap): string {
  let out = text;
  for (const [placeholder, original] of Object.entries(map)) {
    out = out.split(placeholder).join(original);
  }
  return out;
}

/**
 * Placeholders in a model's *output* that were never in its input.
 *
 * A model told "keep [PERSON_1] exactly as written" sometimes reads that as an
 * invitation and writes one of its own. The first live Scriba draft did exactly
 * that: nothing had been redacted, the map was empty, and Llama still produced
 * "[PERSON_1] will lead the discussion." Reinsertion has nothing to substitute,
 * so the organizer would have read a system token in their draft and wondered
 * what broke.
 *
 * The instruction is also tightened in the prompt, but a prompt is a request
 * and this is the guarantee. Unmapped placeholders become `[name]`, `[email]`
 * and so on — lower case, obviously a blank a human fills in, and impossible to
 * mistake for a redaction that failed to come back.
 */
const PLACEHOLDER = /\[(PERSON|EMAIL|PHONE|POSTCODE|GOV_ID|CARD)_\d+\]/g;

const BLANK: Record<PiiKind, string> = {
  PERSON: '[name]',
  EMAIL: '[email address]',
  PHONE: '[phone number]',
  POSTCODE: '[postcode]',
  GOV_ID: '[identifier]',
  CARD: '[card number]',
};

export function scrubInvented(
  text: string,
  map: RedactionMap,
): { text: string; invented: number } {
  let invented = 0;
  const out = text.replace(PLACEHOLDER, (token, kind: PiiKind) => {
    if (token in map) return token;
    invented += 1;
    return BLANK[kind];
  });
  return { text: out, invented };
}

export class RedactionError extends Error {}

/**
 * The last line before dispatch.
 *
 * Re-scans already-redacted text and throws if anything personal survived. Not
 * a substitute for `redact` — a second look at the same text with the same
 * patterns, which catches the case where a caller forgot to redact at all, or
 * redacted one field of a prompt and concatenated another in afterwards.
 *
 * Every path to `INFERENCE_ENDPOINT` calls this. It throws rather than
 * returning a boolean because the only correct response to finding PII on its
 * way to a model is to not send the request.
 */
export function assertRedacted(text: string): void {
  const found: string[] = [];

  for (const { kind, re } of PATTERNS) {
    const matches = text.match(new RegExp(re.source, re.flags));
    if (matches?.length) found.push(`${kind} (${matches.length})`);
  }

  if (found.length) {
    // The offending values are deliberately not in the message: this error will
    // be logged, and a log line containing the PII we just refused to send
    // would defeat the check that produced it.
    throw new RedactionError(
      `Refusing to dispatch: text still contains ${found.join(', ')}. Nothing was sent.`,
    );
  }
}

/**
 * What redaction could not verify, for the review step.
 *
 * Capitalised words that are not sentence-initial and not known vocabulary are
 * *possibly* names we have never seen. This is a hint for a human to check, not
 * a detector — flagging every proper noun would make the warning meaningless,
 * so it is bounded and phrased as a question.
 */
export function residualRisk(text: string): string[] {
  const candidates = new Set<string>();

  for (const match of text.matchAll(/(?<![.!?]\s)(?<!^)\b([A-Z][a-z]{2,})\b/gm)) {
    const word = match[1];
    if (!COMMON_CAPITALISED.has(word.toLowerCase())) candidates.add(word);
  }

  return [...candidates].slice(0, 20);
}

/** Words that are capitalised mid-sentence without being anyone's name. */
const COMMON_CAPITALISED = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'coram', 'the', 'this', 'that', 'there', 'these', 'those', 'and', 'but',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
