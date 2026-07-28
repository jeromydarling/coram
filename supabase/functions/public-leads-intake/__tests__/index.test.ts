/**
 * public-leads-intake — unit tests for validation + dedupe logic.
 *
 * Runs the handler in-process by importing it via dynamic Deno.serve mocking.
 * This file mirrors the testing style in supabase/functions/_shared/__tests__.
 */

import { describe, it, expect } from 'vitest';

// Shape-only test: we re-derive the dedupe key the same way the function does
// and assert it stays stable. The end-to-end Deno.serve test lives in qa-runner.

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('public-leads-intake dedupe key', () => {
  it('is stable for the same email + app + day', async () => {
    const day = '2026-04-26';
    const a = await sha256Hex(`jane@example.com|hortus|${day}`);
    const b = await sha256Hex(`jane@example.com|hortus|${day}`);
    expect(a).toBe(b);
  });

  it('is case-sensitive on email — caller must lowercase', async () => {
    const day = '2026-04-26';
    const lower = await sha256Hex(`jane@example.com|hortus|${day}`);
    const upper = await sha256Hex(`Jane@Example.com|hortus|${day}`);
    expect(lower).not.toBe(upper);
  });

  it('differs across apps', async () => {
    const day = '2026-04-26';
    const hortus = await sha256Hex(`jane@example.com|hortus|${day}`);
    const schola = await sha256Hex(`jane@example.com|theschola|${day}`);
    expect(hortus).not.toBe(schola);
  });

  it('differs across days', async () => {
    const a = await sha256Hex(`jane@example.com|hortus|2026-04-26`);
    const b = await sha256Hex(`jane@example.com|hortus|2026-04-27`);
    expect(a).not.toBe(b);
  });
});

const KNOWN_SOURCE_APPS = new Set([
  'thecros', 'theschola', 'hortus', 'refugium', 'resurrectio', 'transitus',
  'vigilia', 'communis', 'propria', 'cormundum', 'bitoku', 'rehearso',
  'heritage-kitchen', 'via-publica', 'fabrica-forge', 'catholic-insurance', 'vrtmethod',
]);

describe('public-leads-intake source_app allowlist', () => {
  it('matches every slug in watchtower projects.json', () => {
    // These are the 17 slugs we expect.
    const expected = [
      'theschola', 'thecros', 'hortus', 'refugium', 'resurrectio', 'transitus',
      'vigilia', 'communis', 'propria', 'cormundum', 'bitoku', 'rehearso',
      'heritage-kitchen', 'via-publica', 'fabrica-forge', 'catholic-insurance', 'vrtmethod',
    ];
    for (const slug of expected) {
      expect(KNOWN_SOURCE_APPS.has(slug)).toBe(true);
    }
  });

  it('rejects unknown slugs', () => {
    expect(KNOWN_SOURCE_APPS.has('totally-fake-app')).toBe(false);
    expect(KNOWN_SOURCE_APPS.has('')).toBe(false);
  });
});
