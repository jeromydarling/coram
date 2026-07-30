/**
 * What is happening, in the order someone would actually ask.
 *
 * Not a wall of charts. The two questions a group asks on a Tuesday are "when
 * is the next thing" and "what am I late on", so those lead. The module grid
 * below them exists because a person signing in for the first time should be
 * able to see the whole product from one screen rather than discover a third of
 * it by accident three weeks later.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Figure, PageHeader, Section } from '@/components/coram/Page';
import { Failed, Loading } from '@/components/coram/State';
import {
  api,
  apiWithNotice,
  fromNow,
  money,
  when,
  words,
  type BillRow,
  type EventRow,
  type FundRow,
  type Workspace,
} from '@/lib/api';
import { MODULES, TONE_TEXT, TONE_WASH, toneVar } from '@/lib/modules';
import { cn } from '@/lib/utils';

interface QueueRow {
  id: string;
  reason: string;
  display_name: string;
  contact_id: string;
  effective_due_at: string;
  overdue: boolean;
}

export function Overview() {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventRow[]>('/events') });
  const funds = useQuery({ queryKey: ['funds'], queryFn: () => api<FundRow[]>('/funds') });
  const bills = useQuery({ queryKey: ['bills'], queryFn: () => api<BillRow[]>('/petitio/bills') });
  const queue = useQuery({
    queryKey: ['queue', 'mine'],
    queryFn: () => apiWithNotice<QueueRow[], { overdue?: number }>('/vinculum/queue'),
    // An observer and a member both get an empty or forbidden queue. Neither is
    // an error worth shouting about on the front page.
    retry: false,
  });

  if (workspace.isError) return <Failed error={workspace.error} what="We could not load this workspace" />;
  if (workspace.isLoading) return <Loading rows={4} label="Loading the workspace" />;

  const live = (events.data ?? []).filter((e) => !e.cancelled_at);
  const next = live[0];
  const aid = (funds.data ?? []).find((f) => f.kind === 'mutual_aid') ?? funds.data?.[0];
  const bill = bills.data?.[0];
  const due = queue.data?.data ?? [];
  const name = workspace.data?.me.display_name?.split(' ')[0];

  return (
    <>
      <PageHeader
        title={name ? `Good to see you, ${name}.` : (workspace.data?.tenant.name ?? 'Overview')}
        description={
          <>
            {workspace.data?.tenant.name} · {workspace.data?.tenant.contact_count} people on the list
            {workspace.data?.tenant.tier === 'local' ? ' · free tier, all eleven modules' : ''}
          </>
        }
      />

      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div style={toneVar('flame')}>
          <Figure value={workspace.data?.tenant.contact_count ?? '—'} label="People" />
        </div>
        {/*
          A failed query must not render as a confident zero.

          This is the same mistake migration 0015 fixed at the database: an
          events count that silently returned 0 made a busy group look dead. A
          fetch that 500s here would do it again, in the same direction, on the
          first screen anyone sees — so an error says so rather than being
          rounded down to "Nothing scheduled".
        */}
        <div style={toneVar('gold')}>
          <Figure
            value={events.isError ? '—' : live.length}
            label="Events ahead"
            note={
              events.isError
                ? 'We could not load the calendar'
                : next
                  ? when(next.starts_at)
                  : 'Nothing scheduled'
            }
          />
        </div>
        <div style={toneVar('teal')}>
          <Figure
            value={aid ? money(aid.raised_cents, aid.currency) : '—'}
            label={aid?.kind === 'mutual_aid' ? 'Mutual aid raised' : 'Raised'}
            note={
              funds.isError
                ? 'We could not load the funds'
                : aid
                  ? `${money(aid.available_cents, aid.currency)} unspent`
                  : 'No funds open'
            }
          />
        </div>
        <div style={toneVar('rose')}>
          <Figure
            value={queue.isError ? '—' : due.length}
            label="Follow-ups owed"
            note={
              queue.isError
                ? 'Not visible to your role'
                : due.filter((f) => f.overdue).length
                  ? `${due.filter((f) => f.overdue).length} already late`
                  : due.length
                    ? 'All current'
                    : 'Nothing owed'
            }
          />
        </div>
      </div>

      {next && (
        <Section title="Next up" actions={<More to="/events">All events</More>}>
          <div className="paper px-5 py-4" style={toneVar('gold')}>
            <p className="font-display text-xl">{next.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {when(next.starts_at)}
              {next.location_name ? ` · ${next.location_name}` : ''}
            </p>
            <p className="mt-3 text-sm">
              <span className="font-medium tabular-nums">{next.going} going</span>
              {next.capacity ? (
                <span className="text-muted-foreground"> of {next.capacity} places</span>
              ) : null}
              {next.waitlisted ? (
                <span className="text-muted-foreground"> · {next.waitlisted} waiting</span>
              ) : null}
            </p>
          </div>
        </Section>
      )}

      {due.length > 0 && (
        <Section
          title="Owed to people"
          hint="Conversations you said you would have."
          actions={<More to="/relationships">The whole queue</More>}
        >
          <ul className="paper divide-y" style={toneVar('rose')}>
            {due.slice(0, 4).map((f) => (
              <li key={f.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                <span className="font-medium">{f.display_name}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {f.reason}
                </span>
                <span
                  className={cn(
                    'text-sm tabular-nums',
                    f.overdue ? 'font-medium text-flame' : 'text-muted-foreground',
                  )}
                >
                  {fromNow(f.effective_due_at)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {bill && (
        <Section title="The bill you are writing" actions={<More to="/advocacy">Open it</More>}>
          <div className="paper px-5 py-4" style={toneVar('deep')}>
            <p className="font-display text-xl">{bill.working_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bill.jurisdiction}
              {bill.locality ? ` · ${bill.locality}` : ''} · {bill.sections} sections ·{' '}
              {bill.endorsements} endorsements
            </p>
            <Badge variant="outline" className="mt-3 border-deep/40 text-deep">
              {words(bill.stage)}
            </Badge>
          </div>
        </Section>
      )}

      <Section
        title="Everything Coram does"
        hint="Eleven modules. All of them on every tier, including the free one."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link
              key={m.path}
              to={m.path}
              className="paper group flex gap-3.5 px-5 py-4 hover:border-tone/50"
              style={toneVar(m.tone)}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                  TONE_WASH[m.tone],
                )}
              >
                <m.icon aria-hidden className={cn('h-[1.05rem] w-[1.05rem]', TONE_TEXT[m.tone])} />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-[1.05rem]">{m.name}</span>
                  <span className="font-display text-xs italic text-muted-foreground">
                    {m.latin}
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {m.blurb}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}

function More({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      {children}
      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}
