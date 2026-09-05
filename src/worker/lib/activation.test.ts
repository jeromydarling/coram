import { describe, expect, it } from 'vitest';

import {
  ACTIVATION_THRESHOLD,
  ACTIVATION_WINDOW_DAYS,
  computeActivation,
  summarizeActivation,
  type WorkspaceActivity,
} from './activation';

const NOW = new Date('2026-06-01T00:00:00Z');

/** `createdAt` far enough in the past that the window has always closed. */
function workspace(overrides: Partial<WorkspaceActivity> = {}): WorkspaceActivity {
  return {
    tenantId: 't1',
    tenantName: 'Eastside Tenants Union',
    createdAt: '2026-01-01T00:00:00Z',
    firstLoginDates: [],
    ...overrides,
  };
}

const daysAfterCreation = (days: number) =>
  new Date(new Date('2026-01-01T00:00:00Z').getTime() + days * 86_400_000).toISOString();

describe('computeActivation', () => {
  it('is null before the window closes — a young workspace is not a failing one', () => {
    const w = workspace({ createdAt: new Date(NOW.getTime() - 9 * 86_400_000).toISOString() });
    expect(computeActivation(w, NOW)).toBeNull();
  });

  it('judges the instant the window closes, not a day later', () => {
    const created = new Date(NOW.getTime() - ACTIVATION_WINDOW_DAYS * 86_400_000);
    expect(computeActivation(workspace({ createdAt: created.toISOString() }), NOW)).not.toBeNull();
  });

  it('activates at exactly the threshold, not one below it', () => {
    const dates = Array.from({ length: ACTIVATION_THRESHOLD - 1 }, () => daysAfterCreation(2));
    const short = computeActivation(workspace({ firstLoginDates: dates }), NOW);
    expect(short?.activated).toBe(false);

    const exact = computeActivation(
      workspace({ firstLoginDates: [...dates, daysAfterCreation(2)] }),
      NOW,
    );
    expect(exact?.activated).toBe(true);
    expect(exact?.arrivedWithinWindow).toBe(ACTIVATION_THRESHOLD);
  });

  /*
   * The reason this file exists rather than a WHERE clause on last_seen_on: a
   * workspace where everyone logs in constantly is the target outcome, not a
   * false negative, and the fix that made lastSeenOn wrong for this (it is
   * overwritten forward forever) does not apply to firstLoginOn, which is
   * written once. A login three months after the window closed must not count.
   */
  it('does not count an arrival after the window, no matter how active since', () => {
    const dates = [daysAfterCreation(2), daysAfterCreation(3), daysAfterCreation(200)];
    const verdict = computeActivation(workspace({ firstLoginDates: dates }), NOW);
    expect(verdict?.arrivedWithinWindow).toBe(2);
    expect(verdict?.activated).toBe(false);
  });

  it('never logging in counts as never arriving, not as unknown', () => {
    const dates = [daysAfterCreation(1), null, null, null];
    const verdict = computeActivation(workspace({ firstLoginDates: dates }), NOW);
    expect(verdict?.arrivedWithinWindow).toBe(1);
    expect(verdict?.activated).toBe(false);
  });

  it('counts an arrival on the last day of the window', () => {
    const dates = [daysAfterCreation(ACTIVATION_WINDOW_DAYS), daysAfterCreation(0), daysAfterCreation(0)];
    const verdict = computeActivation(workspace({ firstLoginDates: dates }), NOW);
    expect(verdict?.arrivedWithinWindow).toBe(3);
    expect(verdict?.activated).toBe(true);
  });
});

describe('summarizeActivation', () => {
  it('separates the too-new from the judged, and only judges what closed', () => {
    const tooNew = workspace({
      tenantId: 'new',
      createdAt: new Date(NOW.getTime() - 1 * 86_400_000).toISOString(),
    });
    const activated = workspace({
      tenantId: 'good',
      firstLoginDates: [daysAfterCreation(1), daysAfterCreation(2), daysAfterCreation(3)],
    });
    const missed = workspace({ tenantId: 'lonely', firstLoginDates: [daysAfterCreation(1)] });

    const summary = summarizeActivation([tooNew, activated, missed], NOW);

    expect(summary.tooNew).toBe(1);
    expect(summary.judged).toBe(2);
    expect(summary.activated).toBe(1);
    expect(summary.notActivated.map((v) => v.tenantId)).toEqual(['lonely']);
  });

  /*
   * Oldest-first, because a workspace that has been sitting unactivated for
   * six months is a different kind of problem than one that missed the bar
   * last week, and the report should surface the worse one first rather than
   * whatever order the query happened to return rows in.
   */
  it('orders the misses oldest first', () => {
    const recent = workspace({ tenantId: 'recent', createdAt: '2026-04-01T00:00:00Z' });
    const stale = workspace({ tenantId: 'stale', createdAt: '2026-01-01T00:00:00Z' });

    const summary = summarizeActivation([recent, stale], NOW);
    expect(summary.notActivated.map((v) => v.tenantId)).toEqual(['stale', 'recent']);
  });

  it('an empty fleet summarizes to nothing rather than throwing', () => {
    expect(summarizeActivation([], NOW)).toEqual({
      judged: 0,
      tooNew: 0,
      activated: 0,
      notActivated: [],
    });
  });
});
