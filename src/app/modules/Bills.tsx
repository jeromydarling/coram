/**
 * The bill a group is writing, and who could carry it.
 *
 * Two things this screen refuses to do, both carried over from the API that
 * feeds it.
 *
 * It does not gate. Every part is reachable at any stage — the group most
 * likely to want the sponsor list is the one that already has a legislator's
 * ear, and making them finish a severability clause first is how you lose them.
 *
 * And it does not present the committee list as a ranked answer. Matching a
 * draft's subject to the committee likely to hear it is not built yet, so the
 * API returns rosters plus a `limitations` array saying so in words, and this
 * screen renders those words rather than quietly dropping them.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api, type BillRow } from '@/lib/api';
import { Empty, Failed, Loading, Panel } from './Shell';

interface Issue {
  severity: 'blocking' | 'warning';
  section: string | null;
  message: string;
}
interface Section {
  kind: string;
  position: number;
  heading: string | null;
  body: string;
}
interface BillDetail {
  bill: BillRow & { problem: string | null; intent: string | null };
  sections: Section[];
  endorsements: Array<{ id: string; org_name: string; public: boolean }>;
  issues: Issue[];
  ready: boolean;
}
interface Sponsors {
  jurisdiction: string;
  committees: Array<{
    committeeId: string;
    name: string;
    members: Array<{ personId: string; name: string; role: string }>;
  }>;
  legislators: Array<{ id: string; name: string; party: string | null; chamber: string | null; district: string | null }>;
  sources: Array<{ source: string; status: string; ageDays: number }>;
  limitations: string[];
}

export function Bills() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api<BillRow[]>('/petitio/bills'),
  });

  if (isLoading) return <Loading />;
  if (isError) return <Failed error={error} />;
  if (!data?.length) {
    return (
      <Panel title="Bills">
        <Empty reason="No drafts yet. A bill is what a petition becomes when it succeeds." />
      </Panel>
    );
  }

  const id = openId ?? data[0].id;
  return (
    <>
      <Panel title="Bills" hint="What the group is trying to make law.">
        <ul className="space-y-2">
          {data.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setOpenId(b.id)}
                className={`w-full rounded border p-4 text-left ${b.id === id ? 'border-foreground' : ''}`}
              >
                <span className="font-medium">{b.working_name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {b.jurisdiction}
                  {b.locality ? ` · ${b.locality}` : ''} · {b.route.replace(/-/g, ' ')} ·{' '}
                  {b.stage.replace(/_/g, ' ')}
                  {b.filed_as ? ` · ${b.filed_as}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <BillDetailView id={id} />
      <SponsorsView id={id} />
    </>
  );
}

function BillDetailView({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => api<BillDetail>(`/petitio/bills/${id}`),
  });

  if (isLoading) return <Loading />;
  if (isError) return <Failed error={error} />;
  if (!data) return null;

  const blocking = data.issues.filter((i) => i.severity === 'blocking');
  const warnings = data.issues.filter((i) => i.severity === 'warning');

  return (
    <Panel title="The draft">
      {data.bill.problem && (
        <div className="mb-4 rounded border-l-2 border-foreground/30 pl-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">The problem</p>
          <p className="mt-1 text-sm">{data.bill.problem}</p>
        </div>
      )}

      <p className="mb-4 text-sm">
        {data.ready ? (
          <span>Structurally complete. Nothing is blocking it from going in front of an office.</span>
        ) : (
          <span>{blocking.length} thing{blocking.length === 1 ? '' : 's'} still to fix.</span>
        )}
        {warnings.length > 0 && (
          <span className="text-muted-foreground"> {warnings.length} suggestion{warnings.length === 1 ? '' : 's'}.</span>
        )}
      </p>

      {data.issues.length > 0 && (
        <ul className="mb-6 space-y-2">
          {data.issues.map((issue, i) => (
            <li
              key={i}
              className={`rounded border p-3 text-sm ${
                issue.severity === 'blocking' ? 'border-destructive/40' : 'border-dashed'
              }`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4">
        {data.sections
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((s) => (
            <div key={`${s.kind}-${s.position}`}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {s.heading ?? s.kind.replace(/_/g, ' ')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{s.body || <em>Empty</em>}</p>
            </div>
          ))}
      </div>

      {data.endorsements.length > 0 && (
        <>
          <p className="mt-6 text-xs uppercase tracking-wide text-muted-foreground">Endorsed by</p>
          <ul className="mt-1 text-sm">
            {data.endorsements.map((e) => (
              <li key={e.id}>
                {e.org_name}
                {!e.public && <span className="text-muted-foreground"> · not public</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-sm">
        <a href={`/api/petitio/bills/${id}/text`} className="underline">
          Download as plain text
        </a>
      </p>
    </Panel>
  );
}

function SponsorsView({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sponsors', id],
    queryFn: () => api<Sponsors>(`/petitio/bills/${id}/sponsors`),
  });

  if (isLoading) return <Loading />;
  if (isError) return <Failed error={error} />;
  if (!data) return null;

  return (
    <Panel title="Who could carry it">
      {data.limitations.map((line, i) => (
        <p key={i} className="mb-3 rounded border border-dashed p-3 text-sm text-muted-foreground">
          {line}
        </p>
      ))}

      {data.committees.slice(0, 4).map((c) => (
        <div key={c.committeeId} className="mb-4 rounded border p-4">
          <p className="font-medium">{c.name}</p>
          <ul className="mt-2 text-sm">
            {c.members.slice(0, 5).map((m) => (
              <li key={m.personId}>
                <span className="text-muted-foreground">{m.role}</span> · {m.name}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {data.legislators.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.legislators.length} legislators in {data.jurisdiction}
          </p>
          <ul className="mt-2 grid gap-x-6 text-sm sm:grid-cols-2">
            {data.legislators.slice(0, 12).map((l) => (
              <li key={l.id}>
                {l.name}
                <span className="text-muted-foreground">
                  {l.party ? ` · ${l.party}` : ''}
                  {l.district ? ` · district ${l.district}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {data.sources.map((s) => `${s.source}: ${s.status}, ${s.ageDays}d old`).join(' · ')}
      </p>
    </Panel>
  );
}
