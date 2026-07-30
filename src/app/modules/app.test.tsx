// @vitest-environment jsdom
/**
 * Does the app actually render?
 *
 * This file exists because of a specific failure. Every module had a schema, an
 * API, row-level security and passing tests — and /app was a single paragraph
 * reading "Foundation is in place. Membra is next." The demo workspace was
 * seeded, the credentials worked, the endpoints returned real rows, and I
 * verified all of it with curl. Nobody had opened the product.
 *
 * A test that drives the API proves the API. Only a test that mounts the
 * screens proves there is something to look at, so these mount them.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Bills } from './Bills';
import { Contacts } from './Contacts';
import { Events } from './Events';
import { Funds } from './Funds';
import { Overview } from './Overview';

/** Shapes taken from real responses off the deployed API, trimmed to what is read. */
const WORKSPACE = {
  tenant: { id: 't', name: 'Eastside Tenants Union', slug: 'demo-eastside', tier: 'local', contact_count: '240' },
  me: { role: 'observer', display_name: 'Demo visitor', turf_ids: '{}' },
};
const EVENTS = [
  {
    id: 'e1',
    title: 'Rent board hearing',
    starts_at: '2026-08-05T15:24:30.449Z',
    location_name: 'City Hall, chamber B',
    capacity: 120,
    going: 42,
    waitlisted: 0,
    cancelled_at: null,
  },
];
const FUNDS = [
  {
    id: 'f1',
    name: 'Eviction defence fund',
    kind: 'mutual_aid',
    goal_cents: '500000',
    raised_cents: '318400',
    available_cents: '318400',
    currency: 'USD',
  },
];
const BILLS = [
  {
    id: 'b1',
    working_name: 'The repairs ordinance',
    jurisdiction: 'CA',
    locality: 'Eastside',
    route: 'local',
    stage: 'seeking_sponsor',
    filed_as: null,
    sections: 7,
    endorsements: 3,
    updated_at: '2026-07-30T00:00:00Z',
  },
];

function mockApi(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/api/workspace': WORKSPACE,
    '/api/events': EVENTS,
    '/api/funds': FUNDS,
    '/api/contacts': [],
    '/api/consilium/proposals': [],
    '/api/petitio/bills': BILLS,
    '/api/petitio/bills/b1': {
      bill: { ...BILLS[0], problem: 'Landlords delay repairs for months.', intent: null },
      sections: [
        { kind: 'short_title', position: 0, heading: 'Short title', body: 'The Eastside Repairs Ordinance' },
      ],
      endorsements: [{ id: 'x', org_name: 'Riverside Mutual Aid', public: true }],
      issues: [],
      ready: true,
    },
    '/api/petitio/bills/b1/sponsors': {
      jurisdiction: 'CA',
      committees: [],
      legislators: [{ id: 'l1', name: 'A Legislator', party: 'Democratic', chamber: 'lower', district: '18' }],
      sources: [{ source: 'openstates.people', status: 'ok', ageDays: 1 }],
      limitations: ['We do not have committee rosters for CA yet.'],
    },
    ...overrides,
  };

  vi.stubGlobal('fetch', async (url: string) => {
    const path = new URL(url, 'http://localhost').pathname;
    if (!(path in routes)) throw new Error(`unmocked: ${path}`);
    return new Response(JSON.stringify({ ok: true, data: routes[path] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function mount(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('the app renders something', () => {
  it('shows the workspace on the overview, not a placeholder', async () => {
    mockApi();
    mount(<Overview />);

    await waitFor(() => expect(screen.getByText('240')).toBeDefined());
    expect(screen.getByText(/Rent board hearing/)).toBeDefined();
    expect(screen.getByText(/repairs ordinance/i)).toBeDefined();
    // The stat that rendered as an em dash on the live site while the funds
    // screen showed the same figure correctly.
    expect(screen.getByText(/\$3,184/)).toBeDefined();
    // The sentence that used to be the entire product.
    expect(screen.queryByText(/Membra is next/)).toBeNull();
  });

  it('renders events with their attendance', async () => {
    mockApi();
    mount(<Events />);
    await waitFor(() => expect(screen.getByText(/Rent board hearing/)).toBeDefined());
    expect(screen.getByText(/42 going/)).toBeDefined();
  });

  it('renders a fund as money rather than raw cents', async () => {
    mockApi();
    mount(<Funds />);
    await waitFor(() => expect(screen.getByText(/Eviction defence fund/)).toBeDefined());
    expect(screen.getByText(/\$3,184 of \$5,000/)).toBeDefined();
  });

  it('renders the bill, its sections and its endorsements', async () => {
    mockApi();
    mount(<Bills />);
    await waitFor(() => expect(screen.getByText(/The Eastside Repairs Ordinance/)).toBeDefined());
    expect(screen.getByText(/Riverside Mutual Aid/)).toBeDefined();
    expect(screen.getByText(/Structurally complete/)).toBeDefined();
  });

  /*
   * The sponsor list must never read as a ranked recommendation. The API says
   * so in its `limitations` array; this asserts the screen actually shows those
   * words rather than dropping them on the floor.
   */
  it('shows the sponsor caveats rather than dropping them', async () => {
    mockApi();
    mount(<Bills />);
    await waitFor(() =>
      expect(screen.getByText(/do not have committee rosters for CA/)).toBeDefined(),
    );
  });
});

describe('an empty list says which kind of empty it is', () => {
  /*
   * An observer sees no individual contact records by design. Rendered as a
   * bare "no results", a correct permission boundary looks like a broken
   * product — and that is how a working control gets reported as a bug and then
   * "fixed".
   */
  it('explains an observer’s empty contact list as access control', async () => {
    mockApi();
    mount(<Contacts />);

    await waitFor(() => expect(screen.getByText(/none of them are shown here/)).toBeDefined());
    expect(screen.getByText(/denied at the database/)).toBeDefined();
  });

  it('says something different to an organizer, whose limit is turf', async () => {
    mockApi({ '/api/workspace': { ...WORKSPACE, me: { ...WORKSPACE.me, role: 'organizer' } } });
    mount(<Contacts />);

    await waitFor(() => expect(screen.getByText(/No contacts in your turf/)).toBeDefined());
  });
});
