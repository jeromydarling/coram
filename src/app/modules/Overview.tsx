/**
 * What is happening, in the order someone would ask.
 *
 * Deliberately not a dashboard of charts. A group's next meeting and whether
 * their bill has a sponsor are the two questions that actually get asked, and
 * a page of sparklines answers neither.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { api, money, when, type BillRow, type EventRow, type FundRow, type Workspace } from '@/lib/api';
import { Failed, Loading, Panel } from './Shell';

export function Overview() {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventRow[]>('/events') });
  const funds = useQuery({ queryKey: ['funds'], queryFn: () => api<FundRow[]>('/funds') });
  const bills = useQuery({ queryKey: ['bills'], queryFn: () => api<BillRow[]>('/petitio/bills') });

  if (workspace.isError) return <Failed error={workspace.error} />;
  if (workspace.isLoading) return <Loading />;

  const next = events.data?.[0];
  const fund = funds.data?.[0];
  const bill = bills.data?.[0];

  return (
    <>
      <Panel title="Overview" hint={`${workspace.data?.tenant.contact_count} people on the list.`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="People" value={workspace.data?.tenant.contact_count ?? '—'} />
          <Stat label="Upcoming events" value={String(events.data?.length ?? '—')} />
          <Stat
            label="Raised, mutual aid"
            value={fund ? money(fund.raised_cents, fund.currency) : '—'}
          />
        </div>
      </Panel>

      {next && (
        <Panel title="Next up">
          <div className="rounded border p-4">
            <p className="font-medium">{next.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {when(next.starts_at)}
              {next.location_name ? ` · ${next.location_name}` : ''}
            </p>
            <Link to="/events" className="mt-3 inline-block text-sm underline">
              All events
            </Link>
          </div>
        </Panel>
      )}

      {bill && (
        <Panel title="The bill">
          <div className="rounded border p-4">
            <p className="font-medium">{bill.working_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bill.jurisdiction}
              {bill.locality ? ` · ${bill.locality}` : ''} · {bill.stage.replace(/_/g, ' ')} ·{' '}
              {bill.sections} sections · {bill.endorsements} endorsements
            </p>
            <Link to="/bills" className="mt-3 inline-block text-sm underline">
              Open it
            </Link>
          </div>
        </Panel>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
