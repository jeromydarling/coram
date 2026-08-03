/**
 * Sharing must never acquire a credential.
 *
 * The decision this file guards is a product commitment, not an implementation
 * detail: an OAuth token that can post as a tenants union is a subpoena target,
 * a compromise vector, and a dependency on a platform that can revoke it the
 * week the group becomes inconvenient. §5.6 already treats deplatforming as a
 * threat worth engineering against.
 *
 * So the assertions below are mostly negative — that nothing here authenticates
 * to anything, and that a platform which cannot take a pre-filled post says so
 * rather than silently dropping what somebody wrote.
 */

import { describe, expect, it } from 'vitest';

import { intents } from './share';

const TEXT = 'The rent board meets Tuesday at 6.30 in chamber B.';
const LINK = 'https://example.org/hearing';

describe('intent links', () => {
  it('never carries a token, a key or a secret', () => {
    for (const intent of intents(TEXT, LINK)) {
      if (!intent.href) continue;
      expect(intent.href, intent.id).not.toMatch(/token|access_token|api[_-]?key|bearer|secret/i);
    }
  });

  /*
   * These have to be plain URLs the browser can open. Anything that needed a
   * request from us would mean Coram knew whether the group posted, which is
   * neither our business nor something we want a record of.
   */
  it('are ordinary links, opened by the browser and not fetched by us', () => {
    for (const intent of intents(TEXT, LINK)) {
      if (!intent.href) continue;
      expect(intent.href, intent.id).toMatch(/^(https:\/\/|mailto:)/);
    }
  });

  it('puts the words in the link, encoded', () => {
    const x = intents(TEXT, LINK).find((i) => i.id === 'x')!;
    expect(x.href).toContain(encodeURIComponent(TEXT));
    expect(x.href).toContain(encodeURIComponent(LINK));
  });

  /*
   * Facebook's sharer accepts a URL and nothing else. Opening it with a body
   * of text would drop every word the group wrote and give no sign it had —
   * so with no link, the button is disabled and explains itself.
   */
  it('refuses Facebook without a link, and says why', () => {
    const withoutLink = intents(TEXT).find((i) => i.id === 'facebook')!;
    expect(withoutLink.href).toBeNull();
    expect(withoutLink.unavailable).toMatch(/only shares a link/i);

    const withLink = intents(TEXT, LINK).find((i) => i.id === 'facebook')!;
    expect(withLink.href).toContain(encodeURIComponent(LINK));
  });

  /*
   * Mastodon is federated: there is no single host to send anyone to, and
   * guessing one would send people to a server they have no account on. Copy
   * and paste is the honest answer and the explanation says so.
   */
  it('does not invent a Mastodon server', () => {
    const mastodon = intents(TEXT).find((i) => i.id === 'mastodon')!;
    expect(mastodon.href).toBeNull();
    expect(mastodon.unavailable).toMatch(/every server is its own/i);
  });

  it('offers email, which needs no account anywhere', () => {
    expect(intents(TEXT).find((i) => i.id === 'email')?.href).toMatch(/^mailto:/);
  });

  /* Someone typing a quote or an ampersand must not break the link. */
  it('encodes text that would otherwise break the URL', () => {
    const awkward = 'Repairs & "rights" — 100% of us, together?';
    for (const intent of intents(awkward, LINK)) {
      if (!intent.href) continue;
      expect(() => new URL(intent.href!), intent.id).not.toThrow();
      expect(intent.href, intent.id).not.toContain('"');
    }
  });
});
