import { describe, expect, it } from 'vitest';

import { PATHWAYS, draftingOffices, pathwayFor, routesFor, signatureTarget } from './index';

const ALL = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

describe('coverage', () => {
  it('has all fifty states and DC, and nothing else', () => {
    expect(PATHWAYS).toHaveLength(51);
    expect(PATHWAYS.map((p) => p.code).sort()).toEqual([...ALL].sort());
  });

  it('resolves case-insensitively and forgives whitespace', () => {
    expect(pathwayFor('ca')?.code).toBe('CA');
    expect(pathwayFor(' Wy ')?.code).toBe('WY');
    expect(pathwayFor('XX')).toBeNull();
  });

  it('cites a source for every jurisdiction', () => {
    for (const p of PATHWAYS) {
      const cited = Object.values(p.sources).filter(Boolean);
      expect(cited.length).toBeGreaterThan(0);
    }
  });

  /*
   * Shipped, not hidden. A field guide that only shows what it is sure of reads
   * as more authoritative than it is, and this data decides whether a group
   * spends a year gathering signatures.
   */
  it('carries what could not be verified', () => {
    const withGaps = PATHWAYS.filter((p) => p.gaps.length > 0);
    expect(withGaps.length).toBeGreaterThan(40);
  });
});

describe('the count that cannot exist', () => {
  /*
   * Nebraska and DC set their thresholds against voter registration at a future
   * date. There is no number to show. An earlier version of the compiler
   * inferred this from the prose and missed Nebraska, which would have meant
   * showing a Nebraskan a target that cannot exist.
   */
  it.each(['NE', 'DC'])('marks %s unknowable rather than merely absent', (code) => {
    const p = pathwayFor(code)!;
    expect(p.statuteCount).toBeNull();
    expect(p.statuteCountKind).toBe('unknowable');
    expect(p.statuteFormula).toBeTruthy();
  });

  it('sends them to a live lookup instead of a target', () => {
    const t = signatureTarget('NE')!;
    expect(t.count).toBeNull();
    expect(t.guidance).toMatch(/no target exists yet/i);
    expect(t.guidance).toMatch(/registration/i);
  });

  it('never reports a null count as a verified zero', () => {
    for (const p of PATHWAYS) {
      if (p.statuteCount === null) expect(p.statuteCountKind).not.toBe('fixed');
      if (p.statuteCountKind === 'fixed') expect(p.statuteCount).toBeGreaterThan(0);
    }
  });
});

describe('distribution requirements', () => {
  /*
   * The single most dangerous simplification available here. Wyoming's
   * statewide requirement is 40,669; its binding constraint is 15% of turnout
   * in 16 of 23 counties, and the cheapest sixteen already exceed the statewide
   * total. A group filling a progress bar to 40,669 has measured the wrong
   * thing for the whole campaign.
   */
  it('refuses to present a bare number where distribution is the real constraint', () => {
    const t = signatureTarget('WY')!;
    expect(t.count).toBe(40669);
    expect(t.distribution).toBeTruthy();
    expect(t.guidance).toMatch(/not the constraint/i);
    expect(t.guidance).toMatch(/counties or districts/i);
  });

  it.each(['WY', 'AR', 'UT', 'NE'])('%s carries its distribution rule verbatim', (code) => {
    expect(pathwayFor(code)!.distribution).toBeTruthy();
  });

  it('warns in every state that has one', () => {
    for (const p of PATHWAYS) {
      if (!p.distribution || p.statuteCountKind !== 'fixed') continue;
      expect(signatureTarget(p.code)!.guidance).toMatch(/not the constraint/i);
    }
  });
});

describe('routes', () => {
  /*
   * The finding that argues with the brief. It presents the state ballot
   * initiative as one of three pathways a group chooses between. For a majority
   * of jurisdictions it does not exist.
   */
  it('reflects that most jurisdictions have no statutory initiative', () => {
    const none = PATHWAYS.filter((p) => p.statute === 'none');
    expect(none.length).toBeGreaterThan(PATHWAYS.length / 2);
  });

  it('always offers the sponsor route, because it is the only universal one', () => {
    for (const code of ALL) {
      const kinds = routesFor(code).map((r) => r.kind);
      expect(kinds).toContain('sponsor');
      expect(kinds[kinds.length - 1]).toBe('sponsor');
    }
  });

  /*
   * Local leads. For Coram's users a municipal ordinance is usually the fastest
   * real win, and in the 29 jurisdictions with no statewide initiative it is
   * the only citizen-initiated route there is. The brief ranks it third.
   */
  it('puts the local route first wherever it exists', () => {
    for (const code of ALL) {
      const routes = routesFor(code);
      if (routes[0].kind !== 'local') {
        expect(pathwayFor(code)!.localInitiative).toBe(false);
      }
    }
  });

  it('never offers a statewide initiative in a state that has none', () => {
    for (const p of PATHWAYS) {
      if (p.statute !== 'none') continue;
      const kinds = routesFor(p.code).map((r) => r.kind);
      expect(kinds).not.toContain('initiative');
      expect(kinds).not.toContain('indirect-initiative');
    }
  });

  it('describes an indirect initiative as going to the legislature first', () => {
    for (const p of PATHWAYS.filter((x) => x.statute === 'indirect')) {
      const route = routesFor(p.code).find((r) => r.kind === 'indirect-initiative')!;
      expect(route.detail).toMatch(/legislature first/i);
    }
  });

  it('offers a referendum only where there is no initiative to offer instead', () => {
    for (const p of PATHWAYS) {
      const kinds = routesFor(p.code).map((r) => r.kind);
      if (kinds.includes('referendum')) {
        expect(p.statute).toBe('none');
        expect(p.referendum).toBe(true);
      }
    }
  });

  it('returns nothing for an unknown jurisdiction rather than a default', () => {
    expect(routesFor('ZZ')).toEqual([]);
    expect(signatureTarget('ZZ')).toBeNull();
  });
});

describe('drafting', () => {
  /*
   * California's Legislative Counsel will write the bill free for a request
   * signed by 25 electors. That is the most useful single fact in this dataset
   * for a Californian and it belongs in front of them before they write a word.
   */
  it('surfaces California, where the state will draft the bill for you', () => {
    expect(draftingOffices().map((p) => p.code)).toContain('CA');
    const initiative = routesFor('CA').find((r) => r.kind === 'initiative')!;
    expect(initiative.draftingHelp).toMatch(/10243/);
  });

  /*
   * The bug this pins. California, Washington, South Dakota and Wyoming all
   * answer "can a citizen get a draft?" with yes, and in all four the yes
   * applies to initiative proponents only — their drafting offices write
   * ordinary bills for legislators and committees, not for the public. An
   * earlier version put "the state will write the bill for you" on the sponsor
   * route in all four, which would have sent people to an office that turns
   * them away.
   */
  it('never claims the state will draft an ordinary bill for a citizen', () => {
    for (const code of ALL) {
      const sponsor = routesFor(code).find((r) => r.kind === 'sponsor')!;
      expect(sponsor.draftingHelp).toBeNull();
      expect(sponsor.detail).not.toMatch(/will (write|draft) the bill for you/i);
      expect(sponsor.detail).toMatch(/only a sitting member can file it/i);
    }
  });

  it('attaches drafting help to the initiative route, where the offer applies', () => {
    for (const p of PATHWAYS.filter((x) => x.canRequestDraft === true)) {
      const route = routesFor(p.code).find(
        (r) => r.kind === 'initiative' || r.kind === 'indirect-initiative',
      );
      expect(route?.draftingHelp).toBeTruthy();
    }
  });

  /*
   * Research prose is not product copy. The California record opens with a
   * shouted sentence comparing five states, which is a note to a reader of the
   * research and not something to render as our own voice. `detail` is ours;
   * `draftingHelp` is quoted.
   */
  it('keeps raw research prose out of our own copy', () => {
    for (const code of ALL) {
      for (const route of routesFor(code)) {
        expect(route.detail).not.toMatch(/[A-Z]{6,}/);
        expect(route.detail.length).toBeLessThan(320);
      }
    }
  });

  /*
   * Thirteen jurisdictions publish no bill drafting manual — Pennsylvania's was
   * deleted in May 2026 and reads "{Reserved}". Null means none exists, and a
   * link must never be invented to fill the gap.
   */
  it('leaves the manual null rather than substituting a lookalike', () => {
    const without = PATHWAYS.filter((p) => !p.manualUrl);
    expect(without.length).toBeGreaterThan(10);
    expect(without.map((p) => p.code)).toContain('PA');
  });

  it('gives every manual URL an https scheme', () => {
    for (const p of PATHWAYS) {
      if (p.manualUrl) expect(p.manualUrl).toMatch(/^https:\/\//);
    }
  });
});

describe('referendum is not initiative', () => {
  /*
   * Maryland and Kentucky have no initiative at all. Telling a Maryland group
   * it needs 60,157 signatures to pass a law, when that number only lets it
   * overturn one, is a target for a campaign they are not running.
   */
  it.each(['MD', 'KY'])('%s carries its referendum count outside statuteCount', (code) => {
    const p = pathwayFor(code)!;
    expect(p.statute).toBe('none');
    expect(p.statuteCount).toBeNull();
  });

  it('says plainly that a referendum cannot create a law', () => {
    const route = routesFor('MD').find((r) => r.kind === 'referendum');
    expect(route).toBeDefined();
    expect(route!.detail).toMatch(/cannot put a new law/i);
  });
});
