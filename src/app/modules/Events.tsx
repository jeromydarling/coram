import { useQuery } from '@tanstack/react-query';

import { api, when, type EventRow } from '@/lib/api';
import { Empty, Failed, Loading, Panel } from './Shell';

export function Events() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['events'],
    queryFn: () => api<EventRow[]>('/events'),
  });

  return (
    <Panel title="Events" hint="Shifts, meetings, and who said they are coming.">
      {isLoading && <Loading />}
      {isError && <Failed error={error} />}
      {data?.length === 0 && <Empty reason="No upcoming events." />}
      <ul className="space-y-3">
        {data?.map((e) => (
          <li key={e.id} className="rounded border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{e.title}</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {e.going} going{e.waitlisted ? ` · ${e.waitlisted} waitlisted` : ''}
                {e.capacity ? ` of ${e.capacity}` : ''}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {when(e.starts_at)}
              {e.location_name ? ` · ${e.location_name}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
