import { describe, it, expect } from 'vitest';
import {
  buildEnforcedQueryPreview,
  buildCustomRoleBias,
  ROLE_FOCUS_OPTIONS,
  SAMPLE_PHRASES_METRO,
  SAMPLE_PHRASES_NATIONAL,
  checkBlockedPatternsClient,
} from '../useIntentProfile';
import type { IntentProfile } from '../useIntentProfile';

const opportunityProfile: IntentProfile = {
  id: 'test-opp',
  module: 'opportunity',
  required_all: [],
  required_any: ['organization', 'company', 'nonprofit', 'foundation', 'employer', 'firm', 'startup'],
  blocked_patterns: ['-company', 'not nonprofit', 'exclude organization'],
  enforced_suffix: '(organization OR company OR nonprofit OR foundation OR employer OR firm OR startup)',
  scope_mode: 'national',
};

describe('buildEnforcedQueryPreview with role bias', () => {
  it('appends role bias clause when provided', () => {
    const result = buildEnforcedQueryPreview('community impact', opportunityProfile, null, '(director OR vp)');
    expect(result).toContain('community impact');
    expect(result).toContain(opportunityProfile.enforced_suffix);
    expect(result).toContain('(director OR vp)');
  });

  it('does not append role bias when null', () => {
    const result = buildEnforcedQueryPreview('community impact', opportunityProfile, null, null);
    expect(result).not.toContain('director');
  });

  it('does not append role bias when empty string', () => {
    const result = buildEnforcedQueryPreview('community impact', opportunityProfile, null, '');
    expect(result).not.toContain('OR');
    // enforced_suffix has OR, so check it doesn't have extra
    const parts = result.split(opportunityProfile.enforced_suffix);
    expect(parts[1]?.trim() || '').toBe('');
  });

  it('places role bias after suffix and before metro', () => {
    const result = buildEnforcedQueryPreview('test', opportunityProfile, 'Denver', '(director OR vp)');
    const suffixIdx = result.indexOf(opportunityProfile.enforced_suffix);
    const biasIdx = result.indexOf('(director OR vp)');
    const metroIdx = result.indexOf('("in Denver"');
    expect(suffixIdx).toBeLessThan(biasIdx);
    expect(biasIdx).toBeLessThan(metroIdx);
  });
});

describe('buildCustomRoleBias', () => {
  it('returns empty for empty input', () => {
    expect(buildCustomRoleBias('')).toBe('');
    expect(buildCustomRoleBias('   ')).toBe('');
  });

  it('wraps single token in parens', () => {
    expect(buildCustomRoleBias('fundraising')).toBe('(fundraising)');
  });

  it('joins multiple tokens with OR', () => {
    expect(buildCustomRoleBias('fundraising, outreach')).toBe('(fundraising OR outreach)');
  });

  it('strips special characters', () => {
    expect(buildCustomRoleBias('fund-raising; director!')).toBe('(fundraising OR director)');
  });

  it('caps at 10 tokens', () => {
    const input = 'a b c d e f g h i j k l m';
    const result = buildCustomRoleBias(input);
    const orCount = (result.match(/ OR /g) || []).length;
    expect(orCount).toBe(9); // 10 tokens = 9 ORs
  });
});

describe('ROLE_FOCUS_OPTIONS', () => {
  it('has 4 predefined options', () => {
    expect(ROLE_FOCUS_OPTIONS).toHaveLength(4);
  });

  it('each option has key, label, and clause', () => {
    for (const opt of ROLE_FOCUS_OPTIONS) {
      expect(opt.key).toBeTruthy();
      expect(opt.label).toBeTruthy();
      expect(opt.clause).toMatch(/^\(/); // starts with paren
    }
  });
});

describe('SAMPLE_PHRASES', () => {
  it('has metro phrases', () => {
    expect(SAMPLE_PHRASES_METRO.length).toBeGreaterThanOrEqual(5);
  });

  it('has national phrases', () => {
    expect(SAMPLE_PHRASES_NATIONAL.length).toBeGreaterThanOrEqual(5);
  });

  it('sample phrases do not trigger blocked patterns', () => {
    const allPhrases = [...SAMPLE_PHRASES_METRO, ...SAMPLE_PHRASES_NATIONAL];
    for (const phrase of allPhrases) {
      const blocked = checkBlockedPatternsClient(phrase, opportunityProfile.blocked_patterns);
      expect(blocked).toBeNull();
    }
  });
});
