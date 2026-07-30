import { useQuery } from '@tanstack/react-query';

import { api, money, type FundRow } from '@/lib/api';
import { Empty, Failed, Loading, Panel } from './Shell';

export function Funds() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['funds'],
    queryFn: () => api<FundRow[]>('/funds'),
  });

  return (
    <Panel
      title="Funds"
      hint="Coram takes no fee from mutual aid or bail funds — not a discount, zero."
    >
      {isLoading && <Loading />}
      {isError && <Failed error={error} />}
      {data?.length === 0 && <Empty reason="No funds yet." />}
      <ul className="space-y-3">
        {data?.map((f) => {
          const raised = Number(f.raised_cents);
          const goal = f.goal_cents ? Number(f.goal_cents) : null;
          const pct = goal ? Math.min(100, Math.round((raised / goal) * 100)) : null;
          return (
            <li key={f.id} className="rounded border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{f.name}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {f.kind.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="mt-2 text-sm tabular-nums">
                {money(f.raised_cents, f.currency)}
                {goal ? ` of ${money(goal, f.currency)}` : ''}
              </p>
              {pct !== null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
