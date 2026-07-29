import { describe, expect, it } from 'vitest';

import { pathwayFor } from '../../shared/legislative';
import { SCAFFOLD, isReady, renderBill, reviewDraft, scaffoldFor, type BillDraft, type Section } from './bill';

function draft(over: Partial<BillDraft> = {}): BillDraft {
  const sections: Section[] = scaffoldFor('CA').map((s) => ({
    ...s,
    body: s.kind === 'enacting_clause' ? s.body : `Body for ${s.kind}.`,
  }));
  return {
    workingName: 'The repairs bill',
    jurisdiction: 'CA',
    route: 'initiative',
    problem: 'Landlords are not making repairs and tenants have no fast remedy.',
    intent: 'Give tenants a 30-day repair right with a rent-withholding remedy.',
    sections,
    ...over,
  };
}

describe('scaffold', () => {
  it('starts a draft with every required section, in reading order', () => {
    const s = scaffoldFor('CA');
    const required = SCAFFOLD.filter((x) => x.required).map((x) => x.kind);
    expect(s.map((x) => x.kind)).toEqual(required);
    expect(s.map((x) => x.position)).toEqual(s.map((_, i) => i));
  });

  it('fills the enacting clause from the jurisdiction, because it is prescribed', () => {
    const wa = scaffoldFor('WA').find((s) => s.kind === 'enacting_clause')!;
    expect(wa.body).toBe(pathwayFor('WA')!.enactingClause);
    expect(wa.body).toMatch(/BE IT ENACTED/i);
  });

  /*
   * A wrong enacting clause marks a draft as amateur on line two. Where the
   * research could not find one, the field is left empty rather than filled
   * with a plausible clause borrowed from another state.
   */
  it('leaves the clause empty rather than borrowing another state’s', () => {
    const va = pathwayFor('VA')!;
    expect(va.enactingClause).toBeNull();
    expect(scaffoldFor('VA').find((s) => s.kind === 'enacting_clause')!.body).toBe('');
  });

  it('does not scaffold findings, which are optional', () => {
    expect(scaffoldFor('CA').map((s) => s.kind)).not.toContain('findings');
  });

  it('scaffolds nothing but empties for an unknown jurisdiction', () => {
    const s = scaffoldFor('ZZ');
    expect(s.find((x) => x.kind === 'enacting_clause')!.body).toBe('');
  });
});

describe('blocking issues are structural', () => {
  it('accepts a complete draft', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = pathwayFor('CA')!.enactingClause!;
    expect(reviewDraft(d).filter((i) => i.severity === 'blocking')).toEqual([]);
    expect(isReady(d)).toBe(true);
  });

  /*
   * The check the whole module exists for. Undefined operative terms are the
   * most common reason legislative counsel sends citizen language back, so a
   * missing definitions section blocks rather than warns.
   */
  it('blocks a draft with no definitions section', () => {
    const d = draft();
    d.sections = d.sections.filter((s) => s.kind !== 'definitions');
    const issue = reviewDraft(d).find((i) => i.section === 'definitions');
    expect(issue?.severity).toBe('blocking');
    expect(issue?.message).toMatch(/most common reason/i);
    expect(isReady(d)).toBe(false);
  });

  it('blocks an empty required section as firmly as a missing one', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'severability')!.body = '   ';
    expect(reviewDraft(d).some((i) => i.severity === 'blocking' && i.section === 'severability')).toBe(true);
  });

  it('blocks two of a section a bill has one of', () => {
    const d = draft();
    d.sections.push({ kind: 'short_title', position: 9, heading: 'Short title', body: 'Another' });
    expect(reviewDraft(d).some((i) => i.severity === 'blocking' && /more than one/.test(i.message))).toBe(true);
  });

  it('blocks an enacting clause that is not the one the state prescribes', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'enacting_clause')!.body =
      'BE IT ENACTED BY THE PEOPLE OF THE STATE OF WASHINGTON:';
    const issue = reviewDraft(d).find((i) => i.section === 'enacting_clause');
    expect(issue?.severity).toBe('blocking');
    expect(issue?.message).toContain(pathwayFor('CA')!.enactingClause!);
  });

  it('forgives whitespace and trailing punctuation in the clause', () => {
    const d = draft();
    const clause = pathwayFor('CA')!.enactingClause!;
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = `  ${clause.replace(/\s+/g, '  ')}  `;
    expect(reviewDraft(d).some((i) => i.section === 'enacting_clause')).toBe(false);
  });

  it('only warns where we could not find the state’s clause to check against', () => {
    const d = draft({ jurisdiction: 'VA', route: 'sponsor' });
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = 'Be it enacted by the General Assembly:';
    const issue = reviewDraft(d).find((i) => i.section === 'enacting_clause');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toMatch(/could not find/i);
  });

  it('blocks a local ordinance with no locality, because the rules come from a charter', () => {
    const d = draft({ route: 'local', locality: null });
    const issue = reviewDraft(d).find((i) => /city or county/.test(i.message));
    expect(issue?.severity).toBe('blocking');
  });

  it('refuses a jurisdiction it has no field guide for, rather than guessing', () => {
    const issues = reviewDraft(draft({ jurisdiction: 'ZZ' }));
    expect(issues.some((i) => i.severity === 'blocking' && /no field guide/.test(i.message))).toBe(true);
  });
});

describe('substance is advised, never blocked', () => {
  /*
   * The design line. A tool that will not let someone keep working until their
   * prose satisfies a regex is a tool they abandon for a document, which is
   * exactly where they were before this existed. Block on form, advise on
   * substance.
   */
  it('never blocks on the wording of a section', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = pathwayFor('CA')!.enactingClause!;
    d.sections.find((s) => s.kind === 'operative')!.body =
      'The Qualifying Tenant situation is bad and something should happen about it.';
    d.problem = null;

    const issues = reviewDraft(d);
    expect(issues.some((i) => i.severity === 'warning')).toBe(true);
    expect(issues.filter((i) => i.severity === 'blocking')).toEqual([]);
    expect(isReady(d)).toBe(true);
  });

  it('flags a capitalised phrase that is missing from the definitions', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = pathwayFor('CA')!.enactingClause!;
    d.sections.find((s) => s.kind === 'operative')!.body =
      'A Covered Landlord shall complete repairs within 30 days.';
    expect(reviewDraft(d).some((i) => /"Covered Landlord"/.test(i.message))).toBe(true);
  });

  it('does not flag a term that is defined', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = pathwayFor('CA')!.enactingClause!;
    d.sections.find((s) => s.kind === 'definitions')!.body =
      '"Covered Landlord" means an owner of four or more residential units.';
    d.sections.find((s) => s.kind === 'operative')!.body =
      'A Covered Landlord shall complete repairs within 30 days.';
    expect(reviewDraft(d).some((i) => /Covered Landlord/.test(i.message))).toBe(false);
  });

  it('notices an operative section that creates no duty or power', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = pathwayFor('CA')!.enactingClause!;
    d.sections.find((s) => s.kind === 'operative')!.body = 'Housing conditions are poor in this city.';
    expect(reviewDraft(d).some((i) => /duty or a power/.test(i.message))).toBe(true);
  });

  it('accepts must and may as readily as shall', () => {
    for (const verb of ['shall', 'must', 'may']) {
      const d = draft();
      d.sections.find((s) => s.kind === 'enacting_clause')!.body = pathwayFor('CA')!.enactingClause!;
      d.sections.find((s) => s.kind === 'operative')!.body = `An owner ${verb} complete repairs.`;
      expect(reviewDraft(d).some((i) => /duty or a power/.test(i.message))).toBe(false);
    }
  });

  it('warns about a missing problem statement without blocking on it', () => {
    const d = draft({ problem: null });
    const issue = reviewDraft(d).find((i) => /problem statement/.test(i.message));
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toMatch(/first thing/i);
  });
});

describe('render', () => {
  it('lays the draft out like a bill, numbered in order', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'short_title')!.body = 'The Tenant Repairs Act';
    d.sections.find((s) => s.kind === 'enacting_clause')!.body = pathwayFor('CA')!.enactingClause!;

    const text = renderBill(d);
    expect(text).toMatch(/^THE TENANT REPAIRS ACT/);
    expect(text).toContain(pathwayFor('CA')!.enactingClause!);
    const numbers = [...text.matchAll(/^SECTION (\d+)\./gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it('puts definitions before the operative sections', () => {
    const text = renderBill(draft());
    expect(text.indexOf('DEFINITIONS')).toBeLessThan(text.indexOf('OPERATIVE SECTION'));
  });

  /*
   * A group that renames a section sees its own name. The fallback label is only
   * for a section with no heading — which is why the ordering test above cannot
   * assert on the fallback.
   */
  it('prefers the group’s own heading over our label', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'operative')!.heading = 'Repair timelines';
    const text = renderBill(d);
    expect(text).toContain('REPAIR TIMELINES');
    expect(text).not.toContain('PROVISIONS');
  });

  it('falls back to our label when a section has no heading', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'operative')!.heading = null;
    expect(renderBill(d)).toContain('PROVISIONS');
  });

  it('skips empty sections rather than emitting a numbered blank', () => {
    const d = draft();
    d.sections.find((s) => s.kind === 'severability')!.body = '';
    expect(renderBill(d)).not.toContain('SEVERABILITY');
  });

  /*
   * A bill with the group's colours on it looks like a leaflet, and the whole
   * point of this document is that it does not. Plain text, no branding.
   */
  it('carries no branding and ends with a single newline', () => {
    const text = renderBill(draft());
    expect(text).not.toMatch(/#[0-9a-f]{6}/i);
    expect(text).not.toMatch(/<svg|<html/i);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('appends the problem statement only when asked', () => {
    expect(renderBill(draft())).not.toContain('THE PROBLEM THIS ADDRESSES');
    expect(renderBill(draft(), { includeProblem: true })).toContain('THE PROBLEM THIS ADDRESSES');
  });

  it('never leaves a run of blank lines', () => {
    expect(renderBill(draft(), { includeProblem: true })).not.toMatch(/\n{3}/);
  });
});
