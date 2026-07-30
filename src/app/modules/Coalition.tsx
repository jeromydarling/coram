/**
 * Federatio (§5.11) — parents, chapters, and subsidiarity by default.
 *
 * The rule that shapes this screen: a parent organization sees roll-up
 * aggregates only. Reaching a chapter's individual records requires that
 * chapter's explicit, revocable grant. So the parent view is counts, and it
 * says why it is counts — a coalition that assumes it can see more will build a
 * process around data it does not have and then be surprised.
 *
 * The chapter view is the more important half and the one most products omit:
 * what have we given away, to whom, and how do we take it back. Revoking is one
 * button and needs nobody's approval but the chapter's own.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Figure, Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { apiWithNotice, day, del, money, words } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';

const MODULE = MODULES.find((m) => m.path === '/coalition')!;

interface Chapter {
  chapter_tenant_id: string;
  chapter_name: string;
  contacts: string;
  events_upcoming: string;
  funds_raised_cents: string;
  joined_at: string;
}

interface Grant {
  id: string;
  federation_name: string;
  scope: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  active: boolean;
}

export function Coalition() {
  const client = useQueryClient();

  const chapters = useQuery({
    queryKey: ['chapters'],
    queryFn: () => apiWithNotice<Chapter[], { subsidiarity?: string }>('/federatio/chapters'),
    retry: false,
  });
  const grants = useQuery({
    queryKey: ['grants'],
    queryFn: () => apiWithNotice<Grant[]>('/federatio/grants'),
    retry: false,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => del(`/federatio/grants/${id}`),
    onSuccess: () => {
      say('Revoked.', 'They lose access immediately. No notice period, no approval needed.');
      void client.invalidateQueries({ queryKey: ['grants'] });
    },
    onError: (e: Error) => failed('Not revoked', e),
  });

  const isParent = !chapters.isError && (chapters.data?.data.length ?? 0) >= 0 && !chapters.isLoading;
  const rows = chapters.data?.data ?? [];

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Coalition"
        description="A parent sees totals. Individual records stay with the chapter unless the chapter hands them over, and it can take that back at any time without asking."
      />

      <Section title="Chapters">
        {chapters.isLoading ? (
          <Loading rows={2} />
        ) : chapters.isError ? (
          <Empty
            title="This workspace is not a coalition parent"
            reason="Coalitions are the paid tier: a parent organization with chapters underneath it, consolidated billing, and shared segments with scoped visibility. Everything else in Coram works without one."
          />
        ) : rows.length === 0 ? (
          <Empty
            title="No chapters yet"
            reason="Invite a group to join and they decide whether to accept. Joining does not give you their contact list."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((ch) => (
              <li key={ch.chapter_tenant_id} className="paper px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <Building2 aria-hidden className="h-4 w-4 self-center text-rose" />
                  <span className="font-display text-lg">{ch.chapter_name}</span>
                  <span className="ml-auto text-sm text-muted-foreground">
                    joined {day(ch.joined_at)}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Figure value={Number(ch.contacts).toLocaleString('en-US')} label="People" />
                  <Figure value={ch.events_upcoming} label="Events ahead" />
                  <Figure value={money(ch.funds_raised_cents)} label="Raised" />
                </div>
              </li>
            ))}
          </ul>
        )}
        {isParent && chapters.data?.meta.subsidiarity && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {chapters.data.meta.subsidiarity}
          </p>
        )}
      </Section>

      <Section
        title="What we have shared"
        hint="Grants this workspace made to a parent. Revoking takes effect at once."
      >
        {grants.isLoading ? (
          <Loading rows={2} />
        ) : grants.isError ? (
          <Failed error={grants.error} what="We could not load your grants" />
        ) : grants.data?.data.length ? (
          <ul className="paper divide-y">
            {grants.data.data.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                <span className="font-medium">{g.federation_name}</span>
                <Badge variant="secondary" className="font-normal">
                  {words(g.scope)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  since {day(g.granted_at)}
                  {g.expires_at ? ` · expires ${day(g.expires_at)}` : ' · no expiry'}
                </span>
                {g.active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-destructive hover:text-destructive"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(g.id)}
                  >
                    Revoke
                  </Button>
                ) : (
                  <Badge variant="outline" className="ml-auto font-normal">
                    revoked
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing shared. Your parent coalition — if you have one — sees counts and nothing else.
          </p>
        )}
      </Section>

      <Guarantee>
        A grant with no expiry is a grant nobody revisits, so new ones default to twelve months.
        Revocation needs no approval from the parent and takes effect on the next request they make.
      </Guarantee>
    </>
  );
}
