/**
 * The list.
 *
 * The empty state here is the most important copy in the app. An observer sees
 * no individual contact records by design (§4.1), and an organizer sees only
 * their turf — so an empty or short list is very often the access model working
 * exactly as intended. Rendering that as a bare "No results" would make a
 * correct permission boundary look like a broken product, and would teach
 * people to distrust the one thing this product asks them to trust.
 */

import { useQuery } from '@tanstack/react-query';

import { api, type ContactRow, type Workspace } from '@/lib/api';
import { Empty, Failed, Loading, Panel } from './Shell';

export function Contacts() {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api<ContactRow[]>('/contacts'),
  });

  const role = workspace.data?.me.role;
  const total = workspace.data?.tenant.contact_count;

  return (
    <Panel
      title="People"
      hint={total ? `${total} on the list for this workspace.` : undefined}
    >
      {isLoading && <Loading />}
      {isError && <Failed error={error} />}

      {data?.length === 0 && (
        <Empty
          reason={
            role === 'observer'
              ? `This workspace has ${total} people on its list, and none of them are shown here. ` +
                `An observer sees aggregates only — the individual records are denied at the ` +
                `database, not hidden in the interface. Sign in as an organizer to see a turf.`
              : role === 'organizer'
                ? 'No contacts in your turf. Organizers see their own patch rather than the whole list.'
                : 'Nobody on the list yet. Import a CSV or add someone.'
          }
        />
      )}

      {!!data?.length && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Postcode</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="py-2">{c.display_name}</td>
                <td className="py-2 text-muted-foreground">{c.email ?? '—'}</td>
                <td className="py-2 tabular-nums text-muted-foreground">{c.postal_code ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
