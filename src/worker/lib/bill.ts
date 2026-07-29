/**
 * Bill drafting — the structure, the checks, and the rendered text.
 *
 * The reason this file exists rather than a text column: a shared document is
 * something organizers already have for free, and a bill-drafting tool that is
 * a worse Google Doc has no reason to exist. What a document cannot do is know
 * that a draft has no definitions section, or that the enacting clause it needs
 * in Washington is not the one it needs in California.
 *
 * The checks below are the whole product. They come from the one failure mode
 * every drafting guide names first: vague or undefined operative language, which
 * legislative counsel bounces back for clarification and which costs a group a
 * session. This module refuses to call a draft ready while that is true, and
 * says why in words an organizer can act on.
 */

import { pathwayFor } from '../../shared/legislative';

export type SectionKind =
  | 'short_title'
  | 'enacting_clause'
  | 'findings'
  | 'definitions'
  | 'operative'
  | 'severability'
  | 'effective_date';

export interface Section {
  kind: SectionKind;
  position: number;
  heading: string | null;
  body: string;
}

export interface BillDraft {
  workingName: string;
  jurisdiction: string;
  locality?: string | null;
  route: 'local' | 'initiative' | 'indirect-initiative' | 'referendum' | 'sponsor';
  problem?: string | null;
  intent?: string | null;
  sections: Section[];
}

/**
 * The scaffold a new draft starts from, in order.
 *
 * Ordered as a bill is read, not as it is written — someone filling this in
 * top to bottom produces something that looks like statute, which is most of
 * what makes staff take it seriously.
 *
 * `findings` is optional and deliberately so. A findings section is where a
 * group states the problem in the bill itself, and it is genuinely useful in a
 * local ordinance and often stripped out by counsel at state level.
 */
export const SCAFFOLD: Array<{
  kind: SectionKind;
  heading: string;
  guidance: string;
  required: boolean;
  repeatable: boolean;
}> = [
  {
    kind: 'short_title',
    heading: 'Short title',
    guidance:
      'One line, and it is how everyone will refer to this. "The Tenant Repairs Act" beats ' +
      '"An act relating to residential rental property maintenance standards".',
    required: true,
    repeatable: false,
  },
  {
    kind: 'enacting_clause',
    heading: 'Enacting clause',
    guidance:
      'Fixed wording set by your jurisdiction. It is filled in for you where we have it — do ' +
      'not reword it.',
    required: true,
    repeatable: false,
  },
  {
    kind: 'findings',
    heading: 'Findings',
    guidance:
      'Optional. The facts that justify the law, in the law itself. Worth including in a local ' +
      'ordinance; state counsel often strikes it.',
    required: false,
    repeatable: true,
  },
  {
    kind: 'definitions',
    heading: 'Definitions',
    guidance:
      'Every term your operative sections lean on. This is the section that decides whether ' +
      'counsel can work with your draft or sends it back — undefined terms are the most common ' +
      'reason citizen language is rejected.',
    required: true,
    repeatable: false,
  },
  {
    kind: 'operative',
    heading: 'Operative section',
    guidance:
      'What must, may, or must not happen — who does it, by when, and what follows if they do ' +
      'not. One obligation per section. Use "shall" for a duty and "may" for a power, and never ' +
      'the other way round.',
    required: true,
    repeatable: true,
  },
  {
    kind: 'severability',
    heading: 'Severability',
    guidance:
      'If a court strikes one part, the rest survives. Nearly always boilerplate, and its ' +
      'absence is noticed.',
    required: true,
    repeatable: false,
  },
  {
    kind: 'effective_date',
    heading: 'Effective date',
    guidance:
      'When it starts. A date, a period after enactment, or on passage — but say which, because ' +
      'silence defaults to a rule that varies by state.',
    required: true,
    repeatable: false,
  },
];

/**
 * A fresh draft, pre-filled with whatever the jurisdiction determines.
 *
 * The enacting clause is the only thing that can be filled in automatically and
 * be right, because it is prescribed rather than drafted. Where the research
 * could not find it, the section is left empty with its guidance rather than
 * being given a plausible-looking clause from another state — a wrong enacting
 * clause is the kind of error that marks a draft as amateur on line two.
 */
export function scaffoldFor(jurisdiction: string): Section[] {
  const pathway = pathwayFor(jurisdiction);

  return SCAFFOLD.filter((s) => s.required).map((s, i) => ({
    kind: s.kind,
    position: i,
    heading: s.heading,
    body: s.kind === 'enacting_clause' ? (pathway?.enactingClause ?? '') : '',
  }));
}

export type IssueSeverity = 'blocking' | 'warning';

export interface Issue {
  severity: IssueSeverity;
  section: SectionKind | null;
  /** Said to the organizer, in their terms. Never "validation failed". */
  message: string;
}

/** Terms a definitions section should probably carry, drawn from the operative text. */
function undefinedTerms(sections: Section[]): string[] {
  const definitions = sections
    .filter((s) => s.kind === 'definitions')
    .map((s) => s.body.toLowerCase())
    .join(' ');

  const operative = sections
    .filter((s) => s.kind === 'operative')
    .map((s) => s.body)
    .join(' ');

  /*
   * Capitalised multi-word phrases mid-sentence are how statutes signal a
   * defined term — "Qualifying Tenant", "Covered Employer". That convention is
   * the only reliable signal available without parsing, and this is a prompt
   * for a human rather than a checker: it is reported as a warning, never as a
   * block, because a false positive that stops someone drafting is worse than
   * a missed hint.
   */
  const found = new Set<string>();
  for (const m of operative.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g)) {
    const phrase = m[1];
    if (!definitions.includes(phrase.toLowerCase())) found.add(phrase);
  }
  return [...found].slice(0, 6);
}

/**
 * What is wrong with this draft, and what merely needs attention.
 *
 * Blocking issues are structural — a missing required section, an empty one, an
 * enacting clause that does not match the jurisdiction. Everything about the
 * *content* is a warning, because a tool that refuses to let someone keep
 * working until their prose satisfies a regex is a tool they will abandon for a
 * document. The distinction is the design: block on form, advise on substance.
 */
export function reviewDraft(draft: BillDraft): Issue[] {
  const issues: Issue[] = [];
  const present = new Map<SectionKind, Section[]>();
  for (const s of draft.sections) {
    const list = present.get(s.kind) ?? [];
    list.push(s);
    present.set(s.kind, list);
  }

  for (const spec of SCAFFOLD) {
    if (!spec.required) continue;
    const found = present.get(spec.kind) ?? [];
    if (found.length === 0) {
      issues.push({
        severity: 'blocking',
        section: spec.kind,
        message: `No ${spec.heading.toLowerCase()} yet. ${spec.guidance}`,
      });
      continue;
    }
    if (found.every((s) => s.body.trim() === '')) {
      issues.push({
        severity: 'blocking',
        section: spec.kind,
        message: `The ${spec.heading.toLowerCase()} is empty. ${spec.guidance}`,
      });
    }
    if (!spec.repeatable && found.length > 1) {
      issues.push({
        severity: 'blocking',
        section: spec.kind,
        message: `There is more than one ${spec.heading.toLowerCase()}. A bill has exactly one.`,
      });
    }
  }

  const pathway = pathwayFor(draft.jurisdiction);
  if (!pathway) {
    issues.push({
      severity: 'blocking',
      section: null,
      message: `We have no field guide for "${draft.jurisdiction}". Pick a state or DC.`,
    });
    return issues;
  }

  /*
   * The enacting clause is prescribed, so a mismatch is a real error rather than
   * a stylistic note — but only where the research actually found the clause.
   * Comparison is on collapsed whitespace and case: the wording matters, the
   * typography does not.
   */
  const clause = present.get('enacting_clause')?.[0]?.body.trim();
  if (pathway.enactingClause && clause) {
    const norm = (t: string) => t.replace(/\s+/g, ' ').replace(/[.,:;]$/, '').trim().toLowerCase();
    if (norm(clause) !== norm(pathway.enactingClause)) {
      issues.push({
        severity: 'blocking',
        section: 'enacting_clause',
        message:
          `${pathway.name} prescribes its enacting clause and this is not it. It should read: ` +
          `"${pathway.enactingClause}"`,
      });
    }
  } else if (!pathway.enactingClause && clause) {
    issues.push({
      severity: 'warning',
      section: 'enacting_clause',
      message:
        `We could not find ${pathway.name}'s prescribed enacting clause, so we cannot check ` +
        `yours. Copy it from a recent bill in the same chamber.`,
    });
  }

  if (draft.route === 'local' && !draft.locality) {
    issues.push({
      severity: 'blocking',
      section: null,
      message:
        'A local ordinance needs a city or county — the rules and the signature threshold come ' +
        'from its charter, not from state law.',
    });
  }

  if (!draft.problem?.trim()) {
    issues.push({
      severity: 'warning',
      section: null,
      message:
        'No problem statement. This is the first thing a legislator’s staff reads, and often the ' +
        'only thing. One page: what is wrong, what this changes, what happens then.',
    });
  }

  for (const term of undefinedTerms(draft.sections)) {
    issues.push({
      severity: 'warning',
      section: 'definitions',
      message: `"${term}" reads like a defined term but is not in your definitions.`,
    });
  }

  /*
   * "Shall" versus "may" is the one drafting convention worth enforcing at this
   * level, because getting it backwards inverts the meaning of the law. A
   * warning, not a block — some jurisdictions have moved to "must".
   */
  for (const s of draft.sections.filter((x) => x.kind === 'operative')) {
    if (s.body.trim() && !/\b(shall|must|may|is entitled|is required)\b/i.test(s.body)) {
      issues.push({
        severity: 'warning',
        section: 'operative',
        message:
          'This operative section does not say that anyone shall, must, or may do anything. ' +
          'Statutory language creates a duty or a power; a description of a situation does not.',
      });
    }
  }

  return issues;
}

/** Whether the draft is structurally sound enough to put in front of an office. */
export function isReady(draft: BillDraft): boolean {
  return !reviewDraft(draft).some((i) => i.severity === 'blocking');
}

/**
 * The draft as plain text, laid out like a bill.
 *
 * Plain text rather than a PDF because this gets pasted into an email to a
 * scheduler, and because legislative counsel will retype it into their own
 * system regardless. No branding, no logo — a bill with a group's colours on it
 * looks like a leaflet, and the point of this document is that it does not.
 */
export function renderBill(draft: BillDraft, options: { includeProblem?: boolean } = {}): string {
  const out: string[] = [];
  const byKind = (k: SectionKind) => draft.sections.filter((s) => s.kind === k).sort((a, b) => a.position - b.position);

  const title = byKind('short_title')[0]?.body.trim();
  if (title) out.push(title.toUpperCase(), '');

  const clause = byKind('enacting_clause')[0]?.body.trim();
  if (clause) out.push(clause, '');

  let n = 1;
  const emit = (kind: SectionKind, label: string) => {
    for (const s of byKind(kind)) {
      if (!s.body.trim()) continue;
      out.push(`SECTION ${n}. ${(s.heading || label).toUpperCase()}.`, '');
      out.push(s.body.trim(), '');
      n += 1;
    }
  };

  emit('findings', 'Findings');
  emit('definitions', 'Definitions');
  emit('operative', 'Provisions');
  emit('severability', 'Severability');
  emit('effective_date', 'Effective date');

  if (options.includeProblem && draft.problem?.trim()) {
    out.push('', '---', '', 'THE PROBLEM THIS ADDRESSES', '', draft.problem.trim(), '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
