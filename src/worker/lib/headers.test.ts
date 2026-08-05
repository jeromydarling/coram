import { describe, expect, it } from 'vitest';

import { CSP, HSTS, PERMISSIONS_POLICY, isSecure, securityHeaders } from './headers';

/** `script-src 'self'` → ["'self'"]. */
function directive(name: string): string[] {
  const found = CSP.split('; ').find((d) => d === name || d.startsWith(`${name} `));
  if (!found) throw new Error(`No ${name} in the policy`);
  return found.split(' ').slice(1);
}

describe('the content security policy', () => {
  it('denies by default, so a new fetch has to be declared to work', () => {
    expect(directive('default-src')).toEqual(["'none'"]);
  });

  /*
   * The assertion this whole file exists for.
   *
   * 'unsafe-inline' on script-src is the difference between a policy that stops
   * an injected <script> and one that is decoration. It is also a one-word edit
   * that nobody would notice in review and that changes nothing visible about
   * the deployed page, which is exactly the kind of change a test should be
   * standing in front of. §10 — no external JS on any route — is what makes
   * holding this line possible; if a future change needs an inline script, the
   * answer is a file under /assets, not a widened directive.
   */
  it('will not run inline or third-party script, at all', () => {
    expect(directive('script-src')).toEqual(["'self'"]);
  });

  it('allows no plugins, no injected <base>, and no framing', () => {
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'none'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
  });

  it('posts forms only back to ourselves', () => {
    expect(directive('form-action')).toEqual(["'self'"]);
  });

  /*
   * Every remaining directive is same-origin. The two exceptions on img-src are
   * named individually rather than covered by a "contains 'self'" check,
   * because the point is that adding a third host to any of these is a decision
   * somebody has to make on purpose.
   */
  it('fetches everything else from this origin and nowhere else', () => {
    expect(directive('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directive('font-src')).toEqual(["'self'"]);
    expect(directive('connect-src')).toEqual(["'self'"]);
    expect(directive('manifest-src')).toEqual(["'self'"]);
  });

  it('names no external host anywhere', () => {
    expect(CSP).not.toMatch(/https?:\/\//);
    expect(CSP).not.toContain('*');
  });

  /*
   * Not a style rule. `upgrade-insecure-requests` would upgrade nothing in
   * production — every subresource is same-origin — and would break the local
   * wrangler dev server over http, which is the only place this policy gets
   * checked against a real browser before it ships.
   */
  it('does not upgrade insecure requests, so local verification still works', () => {
    expect(CSP).not.toContain('upgrade-insecure-requests');
  });
});

describe('HSTS', () => {
  it('is two years, includes subdomains, and claims preload', () => {
    expect(HSTS).toBe('max-age=63072000; includeSubDomains; preload');
    // The preload list has a one-year floor; anything shorter is rejected.
    expect(Number(/max-age=(\d+)/.exec(HSTS)?.[1])).toBeGreaterThanOrEqual(31536000);
  });

  it('is sent over https and withheld over plain http', () => {
    expect(securityHeaders(true)).toHaveProperty('Strict-Transport-Security', HSTS);
    expect(securityHeaders(false)).not.toHaveProperty('Strict-Transport-Security');
  });
});

describe('Permissions-Policy', () => {
  /*
   * A group whose argument is that we hold as little as possible should not be
   * one permission prompt away from that being untrue. Empty allowlists only.
   */
  it('denies every feature to this document and every frame in it', () => {
    for (const feature of PERMISSIONS_POLICY.split(', ')) {
      expect(feature, feature).toMatch(/^[a-z-]+=\(\)$/);
    }
  });

  it('covers the four that would matter most', () => {
    for (const feature of ['camera', 'microphone', 'geolocation', 'display-capture']) {
      expect(PERMISSIONS_POLICY).toContain(`${feature}=()`);
    }
  });
});

describe('the header set', () => {
  it('still carries the three that were there before the policy', () => {
    const h = securityHeaders(true);
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('no-referrer');
    // Redundant beside frame-ancestors, kept for browsers that predate it.
    expect(h['X-Frame-Options']).toBe('DENY');
  });
});

describe('isSecure', () => {
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

  it('trusts https in the URL', () => {
    expect(isSecure(req('https://coram.app/'))).toBe(true);
    expect(isSecure(req('http://127.0.0.1:8787/'))).toBe(false);
  });

  /*
   * Cloudflare terminates TLS before the Worker sees the request, and in some
   * configurations the URL a Worker is handed is http. The forwarded header is
   * what the edge actually sets, and trusting it is safe here because nothing
   * upstream of the Worker is user-controlled.
   */
  it('trusts a proxy that says it terminated TLS', () => {
    expect(isSecure(req('http://coram.app/', { 'x-forwarded-proto': 'https' }))).toBe(true);
    expect(isSecure(req('http://coram.app/', { 'x-forwarded-proto': 'http' }))).toBe(false);
  });
});
