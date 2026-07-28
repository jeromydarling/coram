import { describe, expect, it } from 'vitest';

import { ageInDays, anyOverdue, describe as describeArtifact, staleness, type Artifact } from './trust';

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-28T00:00:00Z');

const canary = (over: Partial<Artifact> = {}): Artifact => ({
  kind: 'canary',
  title: 'Warrant canary',
  cadence: 'Quarterly',
  dueDays: 100,
  overdueDays: 120,
  publishedAt: null,
  url: null,
  description: '',
  ...over,
});

const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

describe('staleness', () => {
  it('reports never_published when nothing has been published', () => {
    expect(staleness(canary(), NOW)).toBe('never_published');
  });

  it('is current inside the cadence', () => {
    expect(staleness(canary({ publishedAt: daysAgo(30) }), NOW)).toBe('current');
  });

  // §7 names these two numbers: warn at 100 days, overdue at 120.
  it('becomes due at exactly 100 days', () => {
    expect(staleness(canary({ publishedAt: daysAgo(99) }), NOW)).toBe('current');
    expect(staleness(canary({ publishedAt: daysAgo(100) }), NOW)).toBe('due');
  });

  it('becomes overdue at exactly 120 days', () => {
    expect(staleness(canary({ publishedAt: daysAgo(119) }), NOW)).toBe('due');
    expect(staleness(canary({ publishedAt: daysAgo(120) }), NOW)).toBe('overdue');
  });

  it('treats an unparseable date as never published', () => {
    // Understating what exists beats claiming an audit we cannot show.
    expect(staleness(canary({ publishedAt: 'sometime last year' }), NOW)).toBe('never_published');
  });
});

describe('describe', () => {
  it('says overdue plainly rather than softening it', () => {
    const text = describeArtifact(canary({ publishedAt: daysAgo(200) }), NOW);
    expect(text).toMatch(/^Overdue\./);
    expect(text).toContain('200 days ago');
  });

  it('does not claim anything when nothing is published', () => {
    const text = describeArtifact(canary(), NOW);
    expect(text).toBe('Not published yet.');
    // No "coming soon", no "in progress" — those are claims about the future
    // that a transparency page has no business making.
    expect(text).not.toMatch(/soon|progress|shortly/i);
  });
});

describe('anyOverdue', () => {
  it('is true when a single artifact has lapsed', () => {
    expect(
      anyOverdue([canary({ publishedAt: daysAgo(10) }), canary({ publishedAt: daysAgo(300) })], NOW),
    ).toBe(true);
  });

  /*
   * An unpublished artifact is not "overdue" — it has never been promised on a
   * clock. Conflating the two would make the banner permanent from day one and
   * therefore ignored, which is the failure mode §7 is guarding against.
   */
  it('does not treat never-published as overdue', () => {
    expect(anyOverdue([canary()], NOW)).toBe(false);
  });
});

describe('ageInDays', () => {
  it('is null when nothing is published', () => {
    expect(ageInDays(canary(), NOW)).toBeNull();
  });

  it('counts whole days', () => {
    expect(ageInDays(canary({ publishedAt: daysAgo(45) }), NOW)).toBe(45);
  });
});
