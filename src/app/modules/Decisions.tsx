import { useQuery } from '@tanstack/react-query';

import { api, type ProposalRow } from '@/lib/api';
import { Empty, Failed, Loading, Panel } from './Shell';

export function Decisions() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api<ProposalRow[]>('/consilium/proposals'),
  });

  return (
    <Panel title="Decisions" hint="What the group put to a vote, and what it decided.">
      {isLoading && <Loading />}
      {isError && <Failed error={error} />}
      {data?.length === 0 && <Empty reason="Nothing has been proposed yet." />}
      <ul className="space-y-3">
        {data?.map((p) => (
          <li key={p.id} className="rounded border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{p.title}</span>
              <span className="rounded-full border px-2 py-0.5 text-xs">{p.status}</span>
            </div>
            {p.decided_at && (
              <p className="mt-1 text-sm text-muted-foreground">
                Decided {new Date(p.decided_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
