/**
 * Custos (§5.9) — the module under the highest scrutiny for data minimization.
 *
 * Everything here is scoped to the `legal` role at the database. An organizer
 * with full access to the contact list can see none of it, which is the point:
 * jail support is the data most likely to be asked for by someone with a
 * warrant, and the smallest possible number of accounts should be able to
 * produce it.
 *
 * The thirty-day purge is stated at the moment of closing rather than in a
 * settings page, because it is irreversible and somebody may want to write
 * something down first. There is no archive and no export.
 *
 * Panic ends every session everywhere and clears this device. It does not
 * delete anything from the workspace, and the button says so — a person
 * reaching for it under pressure should not have to guess.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ShieldAlert, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Denied, Empty, Failed, Loading } from '@/components/coram/State';
import { api, day, money, post, postWithNotice, words, type Workspace } from '@/lib/api';
import { failed, say, sayResult } from '@/lib/notify';
import { MODULES } from '@/lib/modules';

const MODULE = MODULES.find((m) => m.path === '/safety')!;

interface Case {
  id: string;
  person_name: string;
  facility: string | null;
  booking_ref: string | null;
  status: string;
  needs_bail_cents: string | null;
  next_hearing_on: string | null;
  notes: string | null;
  arrested_on: string | null;
  released_at: string | null;
  closed_at: string | null;
}

export function Safety() {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const cases = useQuery({
    queryKey: ['jail-support'],
    queryFn: () => api<Case[]>('/custos/jail-support'),
    retry: false,
  });
  const guides = useQuery({
    queryKey: ['rights-guides'],
    queryFn: () =>
      api<{ id: string; state_code: string; title: string; body: string }[]>('/custos/rights-guides'),
  });
  const briefings = useQuery({
    queryKey: ['briefings'],
    queryFn: () => api<{ id: string; title: string; body: string; created_at: string }[]>('/custos/briefings'),
  });

  const isLegal = ['legal', 'steward'].includes(workspace.data?.me.role ?? '');

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Safety"
        description="Jail support, legal observers, and what to say if you are stopped. The least data of anything in Coram, held for the shortest time."
        actions={<Panic />}
      />

      {/*
        Always opens on jail support, including for a role that cannot see it.
        A value computed from `isLegal` would be wrong on the first render —
        the workspace query has not resolved yet, so every role got the rights
        tab and the legal role never landed where it needed to be. Defaulting
        to the panel and letting it explain the boundary is both correct while
        loading and better to read: "this is the legal role only" says more
        than a tab that quietly is not there.
      */}
      <Tabs defaultValue="cases">
        <TabsList className="mb-6">
          <TabsTrigger value="cases">Jail support</TabsTrigger>
          <TabsTrigger value="rights">Know your rights</TabsTrigger>
          <TabsTrigger value="briefings">Risk briefings</TabsTrigger>
          <TabsTrigger value="observe">Legal observing</TabsTrigger>
        </TabsList>

        <TabsContent value="cases">
          {!isLegal ? (
            <Denied
              what="Jail support is the legal role only"
              why="Not stewards by default, not organizers, not you unless someone gave you the legal role. The fewer accounts that can produce this list, the less there is to hand over when somebody asks."
            />
          ) : cases.isLoading ? (
            <Loading rows={3} />
          ) : cases.isError ? (
            <Failed error={cases.error} what="We could not load the cases" />
          ) : cases.data?.length === 0 ? (
            <Empty
              title="Nobody in custody"
              reason="Open a case when someone is arrested. It is deleted permanently thirty days after you close it — no archive, no export, nothing to subpoena later."
              action={<NewCase />}
            />
          ) : (
            <>
              <div className="mb-4 flex justify-end">
                <NewCase />
              </div>
              <ul className="space-y-3">
                {cases.data?.map((k) => (
                  <CaseRow key={k.id} k={k} />
                ))}
              </ul>
            </>
          )}

          <Guarantee>
            Thirty days after a case closes, it is deleted by a scheduled job — the person’s name,
            the facility, the booking reference, all of it. That is a hard purge, not a soft delete
            with a flag on it.
          </Guarantee>
        </TabsContent>

        <TabsContent value="rights">
          {guides.isLoading ? (
            <Loading rows={3} />
          ) : guides.data?.length ? (
            <Accordion type="single" collapsible className="paper px-5">
              {guides.data.map((g) => (
                <AccordionItem key={g.id} value={g.id}>
                  <AccordionTrigger className="text-left">
                    <span className="flex items-center gap-2.5">
                      <BookOpen aria-hidden className="h-4 w-4 shrink-0 text-flame" />
                      {g.title}
                      <Badge variant="secondary" className="font-normal">
                        {g.state_code}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{g.body}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <Empty
              title="No guides filed"
              reason="Rights differ by state and by situation, and a wrong one is worse than none. A steward files the guides your legal support has checked."
            />
          )}
        </TabsContent>

        <TabsContent value="briefings">
          {briefings.data?.length ? (
            <ul className="space-y-3">
              {briefings.data.map((b) => (
                <li key={b.id} className="paper px-5 py-4">
                  <p className="font-display text-lg">{b.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed">{b.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{day(b.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="No briefings"
              reason="A risk briefing goes out before an action: what is likely, what to bring, who to call. It is attached to the event so people see it when they RSVP."
            />
          )}
        </TabsContent>

        <TabsContent value="observe">
          <ObserverReport />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CaseRow({ k }: { k: Case }) {
  const client = useQueryClient();
  const closeCase = useMutation({
    mutationFn: (status: string) => postWithNotice(`/custos/jail-support/${k.id}/close`, { status }),
    onSuccess: (r) => {
      sayResult('Closed.', r.notice);
      void client.invalidateQueries({ queryKey: ['jail-support'] });
    },
    onError: (e: Error) => failed('Not closed', e),
  });

  return (
    <li className="paper px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-lg">{k.person_name}</span>
        <Badge variant={k.closed_at ? 'secondary' : 'destructive'} className="font-normal">
          {words(k.status)}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {[
          k.facility,
          k.booking_ref ? `booking ${k.booking_ref}` : null,
          k.next_hearing_on ? `hearing ${day(k.next_hearing_on)}` : null,
          k.needs_bail_cents ? `${money(k.needs_bail_cents)} bail` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'No details recorded'}
      </p>
      {k.notes && <p className="mt-2 text-sm">{k.notes}</p>}
      {!k.closed_at && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(['released', 'transferred', 'unknown'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              disabled={closeCase.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Close this case as ${s}? Everything on it is permanently deleted thirty days from now. There is no archive.`,
                  )
                ) {
                  closeCase.mutate(s);
                }
              }}
            >
              Close as {s}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

function NewCase() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/custos/jail-support', {
        personName: String(form.get('personName') ?? '').trim(),
        facility: String(form.get('facility') ?? '').trim() || undefined,
        bookingRef: String(form.get('bookingRef') ?? '').trim() || undefined,
        needsBailCents: Number(form.get('bail'))
          ? Math.round(Number(form.get('bail')) * 100)
          : undefined,
        nextHearingOn: String(form.get('nextHearingOn') ?? '') || undefined,
        notes: String(form.get('notes') ?? '').trim() || undefined,
      }),
    onSuccess: () => {
      say('Case opened.');
      void client.invalidateQueries({ queryKey: ['jail-support'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not opened', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Open a case</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open a jail support case</DialogTitle>
          <DialogDescription>
            Everything on this case is deleted thirty days after you close it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="personName">Who is being held</Label>
            <Input id="personName" name="personName" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="facility">Facility</Label>
              <Input id="facility" name="facility" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bookingRef">Booking reference</Label>
              <Input id="bookingRef" name="bookingRef" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bail">Bail</Label>
              <Input id="bail" name="bail" type="number" min={0} step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextHearingOn">Next hearing</Label>
              <Input id="nextHearingOn" name="nextHearingOn" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Opening…' : 'Open it'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ObserverReport() {
  const submit = useMutation({
    mutationFn: (form: FormData) =>
      post('/custos/observer-reports', {
        narrative: String(form.get('narrative') ?? '').trim(),
        locationName: String(form.get('locationName') ?? '').trim() || undefined,
        occurredOn: String(form.get('occurredOn')),
        anonymous: form.get('anonymous') === 'anonymous',
      }),
    onSuccess: () => say('Filed.', 'Only the legal role can read it.'),
    onError: (e: Error) => failed('Not filed', e),
  });

  return (
    <Section
      title="File an observer report"
      hint="What you saw, in your words, on the day you saw it."
    >
      <form
        className="paper space-y-4 px-5 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate(new FormData(e.currentTarget));
          e.currentTarget.reset();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="occurredOn">When</Label>
            <Input
              id="occurredOn"
              name="occurredOn"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locationName">Where</Label>
            <Input id="locationName" name="locationName" placeholder="Outside the county courthouse" />
            <p className="text-xs text-muted-foreground">
              A place name a person would say. Coram never records coordinates (§3.7).
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="narrative">What happened</Label>
          <Textarea id="narrative" name="narrative" rows={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="anonymous">Attribution</Label>
          <Select name="anonymous" defaultValue="named">
            <SelectTrigger id="anonymous" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="named">File it under my name</SelectItem>
              <SelectItem value="anonymous">File it anonymously</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? 'Filing…' : 'File the report'}
        </Button>
      </form>
    </Section>
  );
}

/**
 * The button someone presses because they are in trouble.
 *
 * It says exactly what it does and exactly what it does not do. "Panic wipe"
 * that turns out to have left the workspace untouched is a nasty surprise in
 * one direction; one that turns out to have deleted the group's records is a
 * catastrophe in the other.
 */
function Panic() {
  const [open, setOpen] = useState(false);

  const panic = useMutation({
    mutationFn: () => postWithNotice<{ sessionsRevoked: number }>('/custos/panic'),
    onSuccess: () => {
      window.location.href = '/app/login';
    },
    onError: (e: Error) => failed('That did not go through', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-destructive/40 text-destructive">
          <ShieldAlert className="mr-2 h-4 w-4" />
          Panic
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert aria-hidden className="h-5 w-5 text-destructive" />
            Sign out everywhere and clear this device
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                Every session you have, on every device, ends immediately. This browser’s cache,
                cookies and stored data for Coram are cleared.
              </p>
              <p className="font-medium text-foreground">
                Nothing is deleted from the workspace. Your group’s records, contacts and cases are
                untouched, and your colleagues are not signed out.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={panic.isPending} onClick={() => panic.mutate()}>
            {panic.isPending ? 'Clearing…' : 'Do it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
