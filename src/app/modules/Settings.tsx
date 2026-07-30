/**
 * The workspace itself: who is in it, what it looks like, and how to leave with
 * everything or destroy it entirely.
 *
 * Not a §5 module — §5 is closed at eleven and this is configuration. It is
 * where three of §2's four commitments become buttons rather than paragraphs:
 * export everything in a documented format, see exactly which roles reach what,
 * and burn the workspace with no retention period and no sales call.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Flame } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Fact, Facts, Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Failed, Loading } from '@/components/coram/State';
import { api, day, patch, post, put, type Workspace } from '@/lib/api';
import { failed, say } from '@/lib/notify';

const ROLES = ['steward', 'organizer', 'member', 'legal', 'observer'] as const;

const ROLE_MEANS: Record<string, string> = {
  steward: 'Everything, including billing, roles, and destroying the workspace.',
  organizer: 'Their assigned turf: those contacts, and everything that can be done for them.',
  member: 'Their own record, events, proposals, and the group’s channels.',
  legal: 'Safety and jail support. Deliberately not the contact list.',
  observer: 'Read-only totals. No individual contact records, ever.',
};

interface Member {
  id: string;
  role: string;
  display_name: string | null;
  created_at: string;
}

interface Brand {
  name: string;
  primary_hex: string;
  accent_hex: string;
  surface_hex: string;
  ink_hex: string;
}

export function Settings() {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const isSteward = workspace.data?.me.role === 'steward';

  return (
    <>
      <PageHeader
        title="Workspace"
        description={workspace.data?.tenant.name}
      />

      <Tabs defaultValue="people">
        <TabsList className="mb-6">
          <TabsTrigger value="people">Who is in it</TabsTrigger>
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="data">Your data</TabsTrigger>
        </TabsList>

        <TabsContent value="people">
          <Members isSteward={isSteward} />
        </TabsContent>
        <TabsContent value="brand">
          <BrandStudio isSteward={isSteward} />
        </TabsContent>
        <TabsContent value="data">
          <YourData workspace={workspace.data} isSteward={isSteward} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Members({ isSteward }: { isSteward: boolean }) {
  const client = useQueryClient();
  const members = useQuery({
    queryKey: ['members'],
    queryFn: () => api<Member[]>('/workspace/members'),
  });

  const change = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      patch(`/workspace/members/${id}`, { role }),
    onSuccess: () => {
      say('Role changed.');
      void client.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (e: Error) => failed('Not changed', e),
  });

  return (
    <>
      <Section title="Members">
        {members.isLoading ? (
          <Loading rows={3} />
        ) : members.isError ? (
          <Failed error={members.error} />
        ) : (
          <ul className="paper divide-y">
            {members.data?.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <span className="font-medium">{m.display_name ?? 'Unnamed'}</span>
                <span className="text-sm text-muted-foreground">joined {day(m.created_at)}</span>
                {isSteward ? (
                  <Select
                    value={m.role}
                    onValueChange={(role) => change.mutate({ id: m.id, role })}
                  >
                    <SelectTrigger className="ml-auto w-40" aria-label={`Role for ${m.display_name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {m.role}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="What each role reaches" hint="Enforced in the database, not in this page.">
        <dl className="paper divide-y">
          {ROLES.map((r) => (
            <div key={r} className="px-5 py-3">
              <dt className="font-medium">{r}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {ROLE_MEANS[r]}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Guarantee>
        A steward cannot demote the last steward — the workspace would be left with nobody who can
        manage billing or close it. Promote someone else first.
      </Guarantee>
    </>
  );
}

function BrandStudio({ isSteward }: { isSteward: boolean }) {
  const client = useQueryClient();
  const brand = useQuery({ queryKey: ['brand'], queryFn: () => api<Brand>('/brand') });

  const save = useMutation({
    mutationFn: (form: FormData) =>
      put('/brand', {
        name: String(form.get('name') ?? '').trim(),
        primary: String(form.get('primary')),
        accent: String(form.get('accent')),
        surface: String(form.get('surface')),
        ink: String(form.get('ink')),
      }),
    onSuccess: () => {
      say('Saved.');
      void client.invalidateQueries({ queryKey: ['brand'] });
    },
    onError: (e: Error) => failed('Not saved', e),
  });

  if (brand.isLoading) return <Loading rows={2} />;
  if (brand.isError) return <Failed error={brand.error} />;

  const fields: [string, string, string][] = [
    ['primary', 'Primary', brand.data?.primary_hex ?? '#1f5f4f'],
    ['accent', 'Accent', brand.data?.accent_hex ?? '#e2452a'],
    ['surface', 'Surface', brand.data?.surface_hex ?? '#fffaf4'],
    ['ink', 'Ink', brand.data?.ink_hex ?? '#1b1410'],
  ];

  return (
    <>
      <Section
        title="Your group’s colours"
        hint="Used on flyers, public event pages and giving pages — not on this app."
      >
        <form
          className="paper space-y-4 px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="b-name">Group name, as it appears on a flyer</Label>
            <Input
              id="b-name"
              name="name"
              defaultValue={brand.data?.name ?? ''}
              disabled={!isSteward}
              className="max-w-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {fields.map(([name, label, value]) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={`b-${name}`}>{label}</Label>
                <Input
                  id={`b-${name}`}
                  name={name}
                  type="color"
                  defaultValue={value}
                  disabled={!isSteward}
                  className="h-10 w-full p-1"
                />
              </div>
            ))}
          </div>
          {isSteward && (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
        </form>
      </Section>

      <Section title="Make a flyer" hint="Vector, so it prints crisply at any size a copy shop asks for.">
        <p className="text-sm">
          <a className="underline underline-offset-4" href="/api/brand/flyer.svg" target="_blank" rel="noreferrer">
            Open the flyer composer output
          </a>{' '}
          <span className="text-muted-foreground">
            — built from your next event and these colours. Every browser’s print dialogue handles
            an SVG, and a designer can open it and change something.
          </span>
        </p>
      </Section>
    </>
  );
}

function YourData({
  workspace,
  isSteward,
}: {
  workspace: Workspace | undefined;
  isSteward: boolean;
}) {
  return (
    <>
      <Section title="Take it with you" hint="No export fee, no notice period, no sales call.">
        <div className="paper px-5 py-4">
          <Facts>
            <Fact term="Workspace">{workspace?.tenant.name}</Fact>
            <Fact term="Tier">{workspace?.tenant.tier}</Fact>
            <Fact term="People">{workspace?.tenant.contact_count}</Fact>
            <Fact term="Your role">{workspace?.me.role}</Fact>
          </Facts>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/exports/contacts.csv">
                <Download className="mr-2 h-4 w-4" />
                Contacts, CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/exports/contacts.json">
                <Download className="mr-2 h-4 w-4" />
                Contacts and notes, JSON
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/exports/aggregates">
                <Download className="mr-2 h-4 w-4" />
                Aggregates
              </a>
            </Button>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The JSON export carries your sealed notes as ciphertext together with the wrapped key
            record, so they can be opened outside Coram by anyone with the passphrase — and by
            nobody else, including us. The format is documented at{' '}
            <code className="text-xs">/docs/export-format.md</code>.
          </p>
        </div>
      </Section>

      <Section title="The canary and the audit log">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Coram publishes a warrant canary and an access log. Both are at{' '}
          <a className="underline underline-offset-4" href="/security" target="_blank" rel="noreferrer">
            /security
          </a>
          , with the dates they were last updated. A canary without a date is decoration.
        </p>
      </Section>

      {isSteward && <Burn name={workspace?.tenant.name ?? ''} />}
    </>
  );
}

/**
 * The burn switch.
 *
 * §2 promises deletion means deletion, and this is where that stops being a
 * sentence. It types the workspace name because a confirmation dialogue nobody
 * has to read is not a confirmation.
 */
function Burn({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const burn = useMutation({
    mutationFn: () => post('/workspace/burn', { confirm: typed }),
    onSuccess: () => {
      window.location.href = '/';
    },
    onError: (e: Error) => failed('Nothing was deleted', e),
  });

  return (
    <Section title="Destroy this workspace">
      <div className="rounded-lg border border-destructive/30 bg-destructive/[0.05] px-5 py-4">
        <p className="text-sm leading-relaxed">
          Every contact, event, message, fund record and audit entry is deleted immediately.
          Everyone is signed out. Files in storage are queued for destruction. There is no retention
          period, no thirty-day grace, no backup we can restore from, and nobody to call.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="mt-4">
              <Flame className="mr-2 h-4 w-4" />
              Destroy it
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>This cannot be undone</DialogTitle>
              <DialogDescription>
                Type <span className="font-medium text-foreground">{name}</span> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Workspace name"
              autoComplete="off"
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                disabled={typed !== name || burn.isPending}
                onClick={() => burn.mutate()}
              >
                {burn.isPending ? 'Destroying…' : 'Destroy it'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Section>
  );
}
