/**
 * Entitlement enforcement tests.
 *
 * WHAT: Tests AI/Pulse/NRI quota logic and usage percentage.
 * WHERE: src/lib/entitlements.ts
 * WHY: Ensures usage limits are enforced correctly.
 */
import { describe, it, expect } from 'vitest';
import {
  canRunAI,
  canRunPulse,
  canRunAdvancedNRI,
  getDynamicAIQuota,
  getAIQuota,
  getPulseQuota,
  getNRIQuota,
  usagePct,
} from '@/lib/entitlements';

describe('canRunAI()', () => {
  it('allows when under quota', () => {
    const result = canRunAI('base', 10, 1000);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('warns when at 80%', () => {
    const quota = getAIQuota('base');
    const result = canRunAI('base', quota.calls * 0.85, 0);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBe(true);
  });

  it('blocks when at 100%', () => {
    const quota = getAIQuota('base');
    const result = canRunAI('base', quota.calls, 0);
    expect(result.allowed).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('blocks on token limit even if calls are fine', () => {
    const quota = getAIQuota('base');
    const result = canRunAI('base', 0, quota.tokens);
    expect(result.allowed).toBe(false);
  });
});

describe('getDynamicAIQuota()', () => {
  it('scales with active users', () => {
    const q1 = getDynamicAIQuota('core', 1);
    const q5 = getDynamicAIQuota('core', 5);
    expect(q5.calls).toBe(q1.calls * 5);
    expect(q5.tokens).toBe(q1.tokens * 5);
  });

  it('minimum 1 user', () => {
    const q = getDynamicAIQuota('core', 0);
    expect(q.calls).toBeGreaterThan(0);
  });

  it('adds bonus calls/tokens', () => {
    const base = getDynamicAIQuota('core', 1);
    const withBonus = getDynamicAIQuota('core', 1, 100, 5000);
    expect(withBonus.calls).toBe(base.calls + 100);
    expect(withBonus.tokens).toBe(base.tokens + 5000);
  });

  it('uses custom dynamic quota in canRunAI', () => {
    const dynamicQuota = { calls: 10, tokens: 1000 };
    expect(canRunAI('base', 5, 500, dynamicQuota).allowed).toBe(true);
    expect(canRunAI('base', 10, 500, dynamicQuota).allowed).toBe(false);
  });
});

describe('canRunPulse()', () => {
  it('allows when under quota', () => {
    expect(canRunPulse('base', 0).allowed).toBe(true);
  });

  it('blocks when at quota', () => {
    const quota = getPulseQuota('base');
    expect(canRunPulse('base', quota.runs).allowed).toBe(false);
  });

  it('expanded has more runs than base', () => {
    expect(getPulseQuota('expanded').runs).toBeGreaterThan(getPulseQuota('base').runs);
  });
});

describe('canRunAdvancedNRI()', () => {
  it('only advanced tier returns true', () => {
    expect(canRunAdvancedNRI('standard')).toBe(false);
    expect(canRunAdvancedNRI('advanced')).toBe(true);
  });
});

describe('usagePct()', () => {
  it('calculates percentage correctly', () => {
    expect(usagePct(50, 100)).toBe(50);
    expect(usagePct(0, 100)).toBe(0);
  });

  it('caps at 100', () => {
    expect(usagePct(200, 100)).toBe(100);
  });

  it('returns 0 for zero limit', () => {
    expect(usagePct(50, 0)).toBe(0);
  });
});
