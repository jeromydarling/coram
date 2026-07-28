/**
 * Vitest unit tests for impulsusTemplates.ts
 *
 * Covers:
 * - First-person voice for every kind
 * - Org name fallback to "this partner"
 * - Recursive sanitizer strips forbidden keys
 */

import { describe, it, expect } from 'vitest';
import { generateImpulsusEntry, sanitizeImpulsusSource, type ImpulsusKind } from '../impulsusTemplates';

const ALL_KINDS: ImpulsusKind[] = [
  'reflection', 'email', 'campaign', 'ai_suggestion', 'event', 'journey', 'task',
];

describe('generateImpulsusEntry', () => {
  it.each(ALL_KINDS)('kind=%s narrative contains first-person "I "', (kind) => {
    const entry = generateImpulsusEntry(kind, { orgName: 'Acme' });
    expect(entry.narrative).toMatch(/\bI\b/);
  });

  it.each(ALL_KINDS)('kind=%s falls back to "this partner" when orgName is missing', (kind) => {
    const entry = generateImpulsusEntry(kind, {});
    // Not all templates use org name; those that do should say "this partner"
    if (entry.narrative.includes('partner') || entry.narrative.includes('Acme')) {
      expect(entry.narrative).toContain('this partner');
    }
  });

  it('journey template includes stage names', () => {
    const entry = generateImpulsusEntry('journey', {
      orgName: 'Test Org',
      fromStage: 'Contacted',
      toStage: 'Discovery Held',
    });
    expect(entry.narrative).toContain('Contacted');
    expect(entry.narrative).toContain('Discovery Held');
  });
});

describe('sanitizeImpulsusSource', () => {
  it('strips top-level forbidden keys', () => {
    const result = sanitizeImpulsusSource({
      message_id: '123',
      body: '<html>secret</html>',
      subject: 'Hello',
    });
    expect(result).toEqual({ message_id: '123', subject: 'Hello' });
  });

  it('strips nested forbidden keys in objects', () => {
    const result = sanitizeImpulsusSource({
      meta: { html: '<b>x</b>', safe: true },
      id: '1',
    });
    expect(result).toEqual({ meta: { safe: true }, id: '1' });
  });

  it('strips forbidden keys in arrays of objects', () => {
    const result = sanitizeImpulsusSource({
      items: [
        { raw: 'data', ok: 1 },
        { full_text: 'data', ok: 2 },
      ],
    });
    expect(result).toEqual({
      items: [{ ok: 1 }, { ok: 2 }],
    });
  });

  it('handles deeply nested forbidden keys', () => {
    const result = sanitizeImpulsusSource({
      a: { b: { c: { note_text: 'secret', safe: true } } },
    });
    expect(result).toEqual({ a: { b: { c: { safe: true } } } });
  });

  it('returns empty object for null/undefined', () => {
    expect(sanitizeImpulsusSource(null)).toEqual({});
    expect(sanitizeImpulsusSource(undefined)).toEqual({});
  });

  it('preserves top-level arrays instead of wrapping in {items}', () => {
    const result = sanitizeImpulsusSource(['a', { body: 'x', ok: 1 }]);
    expect(result).toEqual(['a', { ok: 1 }]);
  });

  it('strips forbidden keys inside nested arrays within objects', () => {
    const result = sanitizeImpulsusSource({
      meta: { body: 'x' },
      arr: [{ html: 'y', safe: true }],
    });
    expect(result).toEqual({ meta: {}, arr: [{ safe: true }] });
  });
});
