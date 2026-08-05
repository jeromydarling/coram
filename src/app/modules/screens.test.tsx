// @vitest-environment jsdom
/**
 * Do the screens render, and do they say the true thing?
 *
 * The original version of this file existed because /app had been reduced to a
 * single paragraph reading "Foundation is in place. Membra is next." while
 * every API behind it worked and was verified with curl. Nobody had opened the
 * product.
 *
 * This version keeps that job and adds a second one. Several screens carry a
 * sentence that is load-bearing rather than decorative — the opt-out count that
 * must never become a list, the secret ballot that must not show a running
 * tally, the thirty-day purge stated at the moment of closing. Those are the
 * assertions below. A screen that quietly drops one of them still looks fine.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Advocacy } from './Advocacy';
import { Coalition } from './Coalition';
import { Events } from './Events';
import { Governance } from './Governance';
import { Messages } from './Messages';
import { Money } from './Money';
import { Outreach } from './Outreach';
import { Overview } from './Overview';
import { People } from './People';
import { Relationships } from './Relationships';
import { Safety } from './Safety';
import { Studio } from './Studio';

/** Shapes taken from real responses off the deployed API, trimmed to what is read. */
const WORKSPACE = {
  tenant: {
    id: 't',
    name: 'Eastside Tenants Union',
    slug: 'demo-eastside',
    tier: 'local',
    contact_count: '240',
  },
  me: { role: 'steward', display_name: 'Demo visitor', turf_ids: '{}' },
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
    disbursed_cents: '0',
    currency: 'USD',
    is_public: false,
    public_slug: null,
    takeDescription: 'Coram takes nothing from this fund.',
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

const QUEUE = [
  {
    id: 'q1',
    reason: 'Said she would bring two neighbours',
    contact_id: 'c1',
    display_name: 'Alma Reyes',
    email: null,
    phone: null,
    due_at: '2026-07-20T00:00:00Z',
    snoozed_until: null,
    snooze_count: 4,
    escalated_at: null,
    effective_due_at: '2026-07-20T00:00:00Z',
    overdue: true,
  },
];

const ROUTES: Record<string, unknown> = {
  '/api/workspace': WORKSPACE,
  '/api/events': EVENTS,
  '/api/events/e1': {
    event: {
      ...EVENTS[0],
      description: null,
      ends_at: null,
      is_public: false,
      public_slug: null,
      access_transit: true,
      access_step_free: null,
      access_asl: false,
      access_quiet_space: null,
      access_notes: null,
    },
    shifts: [],
    rsvps: [],
  },
  '/api/funds': FUNDS,
  '/api/funds/disbursements': [
    {
      id: 'd1',
      fund_id: 'f1',
      fund_name: 'Eviction defence fund',
      kind: 'mutual_aid',
      amount_cents: '50000',
      currency: 'USD',
      purpose: 'Bond, case 26-CR-1184',
      status: 'requested',
      created_at: '2026-07-25T00:00:00Z',
      approvals: 0,
    },
  ],
  '/api/contacts': [
    {
      id: 'c1',
      display_name: 'Alma Reyes',
      email: 'alma@example.org',
      phone: null,
      postal_code: '94601',
      turf_id: null,
      last_interaction_at: null,
    },
  ],
  '/api/consilium/proposals': [
    {
      id: 'p1',
      title: 'Endorse the repairs ordinance',
      status: 'adopted',
      decided_at: '2026-07-01T00:00:00Z',
      comments: 4,
    },
  ],
  '/api/consilium/bylaws': [],
  '/api/petitio/bills': BILLS,
  '/api/petitio/pathways': [{ code: 'CA', name: 'California' }],
  '/api/vinculum/queue': QUEUE,
  '/api/vinculum/config': { outcomeCodes: [], ladders: [] },
  '/api/campaigns': [
    {
      id: 'm1',
      name: 'Hearing turnout push',
      channel: 'email',
      subject: 'Tuesday, 6pm',
      status: 'draft',
      sent_at: null,
      created_at: '2026-07-20T00:00:00Z',
      recipients: 0,
    },
  ],
  '/api/colloquium/channels': [
    {
      id: 'ch1',
      name: 'hearing-prep',
      kind: 'channel',
      ttl_days: 14,
      joined: true,
      members: 6,
      last_message_at: '2026-07-29T00:00:00Z',
    },
  ],
  '/api/brand/studio': {
    templates: [{ id: 'meeting', name: 'Meeting', blurb: 'The one people put on a fridge.' }],
    sizes: [{ id: 'square', name: 'Square', width: 1080, height: 1080, blurb: 'Feeds.' }],
    channels: [{ id: 'x', name: 'X', limit: 280 }],
    backdrops: [{ id: 'paper', name: 'Paper and ink', blurb: 'Risograph grain.' }],
    canGenerate: true,
  },
  '/api/workspace/turfs': [
    { id: 'tf1', name: 'North of the tracks', contacts: 80, mine: true },
    { id: 'tf2', name: 'Hillcrest', contacts: 80, mine: false },
  ],
  '/api/custos/jail-support': [],
  '/api/custos/rights-guides': [],
  '/api/custos/briefings': [],
  '/api/federatio/chapters': [],
  '/api/federatio/grants': [],
};

/** Extras the routes attach at the top level of the envelope, not inside data. */
const META: Record<string, Record<string, unknown>> = {
  '/api/colloquium/channels': {
    retention: 'We keep who spoke in which room, and never what was said.',
  },
  '/api/vinculum/queue': { overdue: 1, repeatedlySnoozed: 1 },
};

function mockApi(overrides: Record<string, unknown> = {}) {
  const routes = { ...ROUTES, ...overrides };

  vi.stubGlobal('fetch', async (url: string) => {
    const path = new URL(url, 'http://localhost').pathname;
    if (!(path in routes)) throw new Error(`unmocked: ${path}`);
    return new Response(JSON.stringify({ ok: true, data: routes[path], ...(META[path] ?? {}) }), {
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

describe('every module screen renders real content', () => {
  it('the overview leads with the group, not a placeholder', async () => {
    mockApi();
    mount(<Overview />);

    await waitFor(() => expect(screen.getByText('240')).toBeDefined());
    expect(screen.getByText(/Rent board hearing/)).toBeDefined();
    // Twice over: the mutual-aid figure and the unspent note beneath it.
    expect(screen.getAllByText(/\$3,184/).length).toBeGreaterThan(0);
    // The sentence that used to be the entire product.
    expect(screen.queryByText(/Membra is next/)).toBeNull();
  });

  it('the overview shows all eleven modules so none is discovered by accident', async () => {
    mockApi();
    mount(<Overview />);

    await waitFor(() => expect(screen.getByText('Everything Coram does')).toBeDefined());
    for (const latin of [
      'Membra',
      'Vinculum',
      'Convocare',
      'Nuntius',
      'Petitio',
      'Thesaurus',
      'Colloquium',
      'Consilium',
      'Custos',
      'Scriba',
      'Federatio',
    ]) {
      expect(screen.getByText(latin)).toBeDefined();
    }
  });

  it('people lists contacts and offers a way to add one', async () => {
    mockApi();
    mount(<People />);

    await waitFor(() => expect(screen.getByText('Alma Reyes')).toBeDefined());
    expect(screen.getByRole('button', { name: /Add someone/ })).toBeDefined();
    expect(screen.getByRole('link', { name: /Import/ })).toBeDefined();
  });

  it('events renders attendance and the accessibility answers', async () => {
    mockApi();
    mount(<Events />);
    await waitFor(() => expect(screen.getByText(/Rent board hearing/)).toBeDefined());
    expect(screen.getByText(/42 going/)).toBeDefined();
  });

  it('money shows the fund as money and offers the two-person disbursement', async () => {
    mockApi();
    mount(<Money />);
    // Named twice: once as the fund, once as the source of the disbursement.
    await waitFor(() => expect(screen.getAllByText(/Eviction defence fund/).length).toBe(2));
    expect(screen.getAllByText(/\$3,184/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDefined();
  });

  it('advocacy lists the bill with its stage', async () => {
    mockApi();
    mount(<Advocacy />);
    await waitFor(() => expect(screen.getByText(/The repairs ordinance/)).toBeDefined());
    expect(screen.getByText('seeking sponsor')).toBeDefined();
    expect(screen.getByRole('button', { name: /Start a bill/ })).toBeDefined();
  });

  it('governance lists proposals and the bylaws vault', async () => {
    mockApi();
    mount(<Governance />);
    await waitFor(() => expect(screen.getByText(/Endorse the repairs ordinance/)).toBeDefined());
    expect(screen.getByRole('button', { name: /Raise a proposal/ })).toBeDefined();
  });

  it('outreach lists campaigns and offers the composer', async () => {
    mockApi();
    mount(<Outreach />);
    await waitFor(() => expect(screen.getByText(/Hearing turnout push/)).toBeDefined());
    expect(screen.getByRole('button', { name: /Write something/ })).toBeDefined();
  });

  it('messages lists channels with their TTL', async () => {
    mockApi();
    mount(<Messages />);
    await waitFor(() => expect(screen.getByText('hearing-prep')).toBeDefined());
    expect(screen.getByText(/forgets after 14 days/)).toBeDefined();
  });

  it('relationships shows the queue with what is overdue', async () => {
    mockApi();
    mount(<Relationships />);
    await waitFor(() => expect(screen.getByText('Alma Reyes')).toBeDefined());
    expect(screen.getByText(/Said she would bring two neighbours/)).toBeDefined();
  });

  it('safety renders without a jail-support case, since most days there is none', async () => {
    mockApi();
    mount(<Safety />);
    await waitFor(() => expect(screen.getByText(/Nobody in custody/)).toBeDefined());
  });

  it('coalition explains the paid tier rather than showing an empty grid', async () => {
    mockApi({ '/api/federatio/chapters': [] });
    mount(<Coalition />);
    await waitFor(() => expect(screen.getByText(/No chapters yet/)).toBeDefined());
  });
});

describe('adding a contact', () => {
  /*
   * The bug the browser suite caught and nothing local would have.
   *
   * contacts_insert admits an organizer only when the new row lands in a turf
   * they hold — "so they cannot create a row they would then be unable to see".
   * The form had no turf field, so every insert an organizer attempted was
   * refused, and adding a contact was impossible for the role most people have.
   */
  it('offers a turf, because an organizer cannot file someone without one', async () => {
    mockApi({ '/api/workspace': { ...WORKSPACE, me: { ...WORKSPACE.me, role: 'organizer' } } });
    mount(<People />);

    await waitFor(() => expect(screen.getByRole('button', { name: /add someone/i })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /add someone/i }));

    // Twice over: Radix renders the selected value in the trigger as well as
    // in the list, which is also proof it defaulted rather than sitting empty.
    await waitFor(() =>
      expect(screen.getAllByText('North of the tracks — 80 people').length).toBeGreaterThan(0),
    );
  });

  /* Only the turfs this caller holds. `mine: false` is somebody else's patch. */
  it('does not offer a turf the caller could not then see into', async () => {
    mockApi({ '/api/workspace': { ...WORKSPACE, me: { ...WORKSPACE.me, role: 'organizer' } } });
    mount(<People />);

    await waitFor(() => expect(screen.getByRole('button', { name: /add someone/i })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /add someone/i }));

    await waitFor(() => expect(screen.getAllByText(/North of the tracks/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Hillcrest/)).toBeNull();
  });
});

describe('the studio', () => {
  it('offers a flyer and a social card without a twelfth module', async () => {
    mockApi();
    mount(<Studio />);

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Studio' })).toBeDefined());
    expect(screen.getByRole('tab', { name: 'Flyer' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Social' })).toBeDefined();
  });

  /*
   * §5.6 and §7 in one sentence, at the point where somebody would look for a
   * "connect your accounts" button. If this line ever disappears it will be
   * because someone added the button.
   */
  it('says plainly that Coram will not post for you', async () => {
    mockApi();
    mount(<Studio />);

    await waitFor(() =>
      expect(screen.getByText(/does not hold your social accounts/i)).toBeDefined(),
    );
    expect(screen.getByText(/subpoena target/i)).toBeDefined();
  });

  /*
   * The rule is enforced in the prompt and in the negative prompt, but a person
   * choosing a style should be told before they press it — not discover it by
   * getting something they did not ask for.
   */
  it('tells you a generated background will never contain a person', async () => {
    mockApi();
    mount(<Studio />);

    await waitFor(() => expect(screen.getByText(/Generate a background/i)).toBeDefined());
    expect(screen.getByText(/Never a person/i)).toBeDefined();
  });

  it('hides generation entirely where the binding is absent', async () => {
    mockApi({
      '/api/brand/studio': { ...(ROUTES['/api/brand/studio'] as object), canGenerate: false },
    });
    mount(<Studio />);

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Studio' })).toBeDefined());
    // A button that answers 501 is worse than no button.
    expect(screen.queryByText(/Generate a background/i)).toBeNull();
  });
});

describe('the sentences that are load-bearing', () => {
  /*
   * §5.2: a queue full of thrice-snoozed items is not a queue, it is a list of
   * things nobody is going to do. Hiding the count would make the screen calmer
   * and less true.
   */
  it('relationships surfaces the snooze count rather than hiding it', async () => {
    mockApi();
    mount(<Relationships />);
    await waitFor(() => expect(screen.getByText(/snoozed 4×/)).toBeDefined());
    expect(screen.getByText('Snoozed 3+ times')).toBeDefined();
  });

  /*
   * §5.6: the zero take on bail and mutual aid is a permanent product
   * commitment, and a screen that quietly stopped saying so would be the first
   * step to it not being one.
   */
  it('money states the zero take on mutual aid', async () => {
    mockApi();
    mount(<Money />);
    await waitFor(() => expect(screen.getByText('no platform take')).toBeDefined());
    expect(screen.getByText(/Bail and mutual aid pay Coram nothing/)).toBeDefined();
    expect(screen.getByText(/no setting anywhere in Coram that changes it/)).toBeDefined();
  });

  /*
   * §5.9: irreversible, so it is said at the moment of closing rather than in
   * a settings page nobody opens.
   */
  it('safety states the thirty-day purge', async () => {
    mockApi();
    mount(<Safety />);
    await waitFor(() => expect(screen.getByText(/thirty days/i)).toBeDefined());
  });

  /*
   * §5.7: the retention promise travels with the response and has to reach the
   * screen, not get dropped on the floor by the envelope unwrapper.
   */
  it('messages shows the retention notice the API attaches', async () => {
    mockApi();
    mount(<Messages />);
    await waitFor(() => expect(screen.getByText(/never what was said/)).toBeDefined());
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
    mockApi({
      '/api/workspace': { ...WORKSPACE, me: { ...WORKSPACE.me, role: 'observer' } },
      '/api/contacts': [],
    });
    mount(<People />);

    await waitFor(() => expect(screen.getByText(/Observers see totals, never people/)).toBeDefined());
    expect(screen.getByText(/at the database/)).toBeDefined();
  });

  it('says something different to an organizer, whose limit is turf', async () => {
    mockApi({
      '/api/workspace': { ...WORKSPACE, me: { ...WORKSPACE.me, role: 'organizer' } },
      '/api/contacts': [],
    });
    mount(<People />);

    await waitFor(() => expect(screen.getByText(/No contacts in your turf/)).toBeDefined());
  });

  /*
   * §5.9 gives jail support to the legal role only. A steward who is not also
   * legal gets a 403, and that has to read as the boundary it is rather than as
   * a fault in the product.
   */
  it('explains a denied jail-support list rather than showing an error', async () => {
    mockApi({
      '/api/workspace': { ...WORKSPACE, me: { ...WORKSPACE.me, role: 'organizer' } },
    });
    mount(<Safety />);

    await waitFor(() =>
      expect(screen.getByText(/Jail support is the legal role only/)).toBeDefined(),
    );
  });
});
