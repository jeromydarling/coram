/**
 * The page a group chooses to have.
 *
 * The tests that matter here are about what the page refuses to say. It is
 * served without a session to anyone who asks, so the interesting failure is
 * not a broken render — it is a page that leaks the existence of a workspace
 * that decided not to publish, or that names somebody.
 */

import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../env';
import { publicGroup } from './public-group';

interface Fixture {
  group?: Record<string, unknown>;
  events?: Record<string, unknown>[];
}

/*
 * db() builds a client from the Hyperdrive binding, so it is stubbed rather
 * than the binding. Everything below drives the route through Hono's request
 * helper, which is the same path a real request takes.
 */
vi.mock('../lib/db', () => ({
  db: (c: { env: { __fixture: Fixture } }) => {
    const fixture = c.env.__fixture;
    const client = (strings: TemplateStringsArray) => {
      const text = strings.join('');
      if (text.includes('public_group_events')) return Promise.resolve(fixture.events ?? []);
      if (text.includes('public_group')) {
        return Promise.resolve(fixture.group ? [fixture.group] : []);
      }
      throw new Error(`unexpected query: ${text}`);
    };
    return Object.assign(client, {
      begin: (fn: (tx: unknown) => unknown) => Promise.resolve(fn(client)),
      end: () => Promise.resolve(),
    });
  },
}));

const GROUP = {
  tenant_id: 't1',
  name: 'Eastside Tenants Union',
  tagline: 'Tenants organising for repairs in Eastside.',
  about: 'We are tenants in the same few blocks.\n\nWe meet on the third Tuesday.',
  contact: 'hello@example.org',
  get_involved: 'Come to the general meeting. No need to tell us first.',
};

const EVENT = {
  title: 'Rent board hearing',
  starts_at: '2099-08-05T18:30:00Z',
  ends_at: null,
  location_name: 'City Hall',
  public_slug: 'rent-board-hearing',
  spots_taken: '21',
  capacity: 120,
};

const fetchPage = (slug: string, fixture: Fixture) =>
  publicGroup.request(`/g/${slug}`, {}, { __fixture: fixture } as unknown as Env);

describe('/g/:slug', () => {
  it('renders the group’s own words', async () => {
    const res = await fetchPage('eastside', { group: GROUP, events: [EVENT] });
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('Eastside Tenants Union');
    expect(html).toContain('Tenants organising for repairs in Eastside.');
    expect(html).toContain('We meet on the third Tuesday.');
    expect(html).toContain('Rent board hearing');
    // A JSX mistake that renders a component reference typecheck-passes.
    expect(html).not.toContain('[object Object]');
  });

  /*
   * The security property of the whole page.
   *
   * `coram.public_group` returns nothing both for a workspace that has not
   * published and for a slug nobody has taken, and this route must render one
   * wording for both. Somebody walking a list of likely names — eastside-tenants,
   * eastsidetenants, eastside-tu — must learn whether a page is published and
   * nothing at all about who exists and chose not to publish.
   */
  it('is the same 404 for an unpublished workspace and a name nobody took', async () => {
    const missing = await fetchPage('nobody-here', {});
    const unpublished = await fetchPage('eastside', {});

    expect(missing.status).toBe(404);
    expect(unpublished.status).toBe(404);
    expect(await missing.text()).toBe(await unpublished.text());
  });

  it('says nothing about workspaces, publishing or settings in the 404', async () => {
    const html = await (await fetchPage('nope', {})).text();
    for (const leak of ['workspace', 'publish', 'not published', 'private', 'Coram']) {
      expect(html.toLowerCase(), leak).not.toContain(leak.toLowerCase());
    }
  });

  /*
   * §10, on the one route most likely to be read by somebody an adversary is
   * interested in. A page advertising a tenants' union must not tell a third
   * party who is reading it.
   */
  it('loads nothing from anywhere else and sets no cookie', async () => {
    const res = await fetchPage('eastside', { group: GROUP, events: [EVENT] });
    const html = await res.text();

    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/src="https?:/);
    expect(html).not.toMatch(/href="https?:\/\//);
    expect(html).not.toMatch(/@import|fonts\.googleapis|cdn\./);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  /*
   * A public attendee list is a roster of who will be at an action. The event
   * page has said so since §5.3 and this page inherits the rule: a count, and
   * then it stops.
   */
  it('shows how many are going and never who', async () => {
    const html = await (await fetchPage('eastside', { group: GROUP, events: [EVENT] })).text();
    expect(html).toContain('21 going');
    expect(html).not.toContain('Solveig');
    expect(html).not.toMatch(/attendee|rsvp list|who is coming/i);
  });

  it('says a full event is full rather than printing the number', async () => {
    const html = await (
      await fetchPage('eastside', {
        group: GROUP,
        events: [{ ...EVENT, spots_taken: '120', capacity: 120 }],
      })
    ).text();
    expect(html).toContain('full');
    expect(html).not.toContain('120 going');
  });

  /*
   * The about text is stored, editable by a steward, and rendered to strangers.
   * JSX escapes it; this asserts that rather than assuming it, because the one
   * place markup could get in is the one place there is no session.
   */
  it('renders the group’s text as text, never as markup', async () => {
    const html = await (
      await fetchPage('eastside', {
        group: { ...GROUP, about: 'We are <script>alert(1)</script> tenants.' },
      })
    ).text();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('holds up with an empty diary rather than showing a bare heading', async () => {
    const html = await (await fetchPage('eastside', { group: GROUP, events: [] })).text();
    expect(html).toMatch(/Nothing is scheduled publicly/i);
  });

  it('survives a group that filled in only the required parts', async () => {
    const res = await fetchPage('eastside', {
      group: { ...GROUP, tagline: null, contact: null, get_involved: null },
      events: [],
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Eastside Tenants Union');
    expect(html).not.toContain('null');
  });
});
