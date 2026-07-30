/**
 * Convocare (§5.3) — meetings, shifts, and who is coming.
 *
 * Two details here are the spec rather than taste:
 *
 *   - Accessibility is three-state, not a checkbox. "Nobody has said whether
 *     there is step-free access" and "there is no step-free access" are
 *     different answers, and collapsing them tells someone deciding whether
 *     they can physically get into the room something we do not know.
 *   - Check-in is a boolean and nothing else. No location capture, ever
 *     (§3.7). A scan records that a person arrived; it does not record where
 *     the phone was when it happened.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Accessibility, CalendarPlus, Car, Ear, TrainFront, Volume2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Fact, Facts, PageHeader, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { api, post, postWithNotice, when, type EventRow, type Workspace } from '@/lib/api';
import { failed, say, sayResult } from '@/lib/notify';
import { MODULES } from '@/lib/modules';
import { cn } from '@/lib/utils';

const MODULE = MODULES.find((m) => m.path === '/events')!;

interface EventDetail {
  event: EventRow & {
    description: string | null;
    ends_at: string | null;
    is_public: boolean;
    public_slug: string | null;
    access_transit: boolean | null;
    access_step_free: boolean | null;
    access_asl: boolean | null;
    access_quiet_space: boolean | null;
    access_notes: string | null;
  };
  shifts: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
    slots: number;
    filled: number;
  }[];
  rsvps: {
    id: string;
    status: string;
    display_name: string;
    contact_id: string;
    guest_count: number;
    needs_ride: boolean;
    can_offer_ride: boolean;
    ride_seats: number | null;
    childcare_children: number | null;
    access_needs: string | null;
    checked_in: boolean;
  }[];
}

type AccessKey = 'access_transit' | 'access_step_free' | 'access_asl' | 'access_quiet_space';

const ACCESS: { key: AccessKey; label: string; icon: typeof TrainFront }[] = [
  { key: 'access_transit', label: 'On a transit line', icon: TrainFront },
  { key: 'access_step_free', label: 'Step-free', icon: Accessibility },
  { key: 'access_asl', label: 'ASL interpretation', icon: Ear },
  { key: 'access_quiet_space', label: 'Quiet space', icon: Volume2 },
];

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function Events() {
  const [open, setOpen] = useState<string | null>(null);
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventRow[]>('/events') });
  const canEdit = !['observer', 'member', 'legal'].includes(workspace.data?.me.role ?? '');

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Events"
        description="Every event carries its accessibility answers, because someone deciding whether they can get into the room should not have to phone and ask."
        actions={canEdit && <NewEvent />}
      />

      {events.isLoading ? (
        <Loading rows={3} label="Loading events" />
      ) : events.isError ? (
        <Failed error={events.error} what="We could not load the calendar" />
      ) : events.data?.length === 0 ? (
        <Empty
          title="Nothing scheduled"
          reason="Put the next meeting in and people can RSVP from a public page without making an account."
          action={canEdit ? <NewEvent /> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {events.data?.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setOpen(e.id)}
                className="paper block w-full px-5 py-4 text-left hover:border-tone/50"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-xl">{e.title}</span>
                  {e.cancelled_at && <Badge variant="destructive">cancelled</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {when(e.starts_at)}
                  {e.location_name ? ` · ${e.location_name}` : ''}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium tabular-nums">{e.going} going</span>
                  {e.capacity ? (
                    <span className="text-muted-foreground"> of {e.capacity} places</span>
                  ) : null}
                  {e.waitlisted ? (
                    <span className="text-muted-foreground"> · {e.waitlisted} on the waitlist</span>
                  ) : null}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <EventPanel id={open} canEdit={canEdit} onClose={() => setOpen(null)} />
    </>
  );
}

function EventPanel({
  id,
  canEdit,
  onClose,
}: {
  id: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ['event', id],
    queryFn: () => api<EventDetail>(`/events/${id}`),
    enabled: Boolean(id),
  });

  const cancel = useMutation({
    mutationFn: () => postWithNotice(`/events/${id}/cancel`, { reason: 'Called off' }),
    onSuccess: (r) => {
      sayResult('Cancelled.', r.notice);
      void client.invalidateQueries({ queryKey: ['events'] });
      void client.invalidateQueries({ queryKey: ['event', id] });
    },
    onError: (e: Error) => failed('Could not cancel', e),
  });

  const addShift = useMutation({
    mutationFn: (form: FormData) => {
      const date = detail.data!.event.starts_at.slice(0, 10);
      return post(`/events/${id}/shifts`, {
        name: String(form.get('name') ?? '').trim(),
        startsAt: new Date(`${date}T${form.get('from')}`).toISOString(),
        endsAt: new Date(`${date}T${form.get('to')}`).toISOString(),
        slots: Number(form.get('slots') ?? 1),
        requiredSkills: [],
      });
    },
    onSuccess: () => {
      say('Shift added.');
      void client.invalidateQueries({ queryKey: ['event', id] });
    },
    onError: (e: Error) => failed('Shift not added', e),
  });

  const signUp = useMutation({
    mutationFn: (shiftId: string) => post(`/events/shifts/${shiftId}/signup`),
    onSuccess: () => {
      say('You are on that shift.');
      void client.invalidateQueries({ queryKey: ['event', id] });
    },
    onError: (e: Error) => failed('Could not sign you up', e),
  });

  const d = detail.data;
  const needRides = d?.rsvps.filter((r) => r.needs_ride) ?? [];
  const offerRides = d?.rsvps.filter((r) => r.can_offer_ride) ?? [];
  const childcare = d?.rsvps.filter((r) => (r.childcare_children ?? 0) > 0) ?? [];

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {detail.isLoading && <Loading rows={4} />}
        {detail.isError && <Failed error={detail.error} />}
        {d && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-2xl">{d.event.title}</SheetTitle>
            </SheetHeader>

            <div className="mt-6">
              <Facts>
                <Fact term="Starts">{when(d.event.starts_at)}</Fact>
                <Fact term="Ends">{d.event.ends_at ? when(d.event.ends_at) : 'Open-ended'}</Fact>
                <Fact term="Where">{d.event.location_name ?? 'Not said'}</Fact>
                <Fact term="Going">
                  {d.event.going}
                  {d.event.capacity ? ` of ${d.event.capacity}` : ''}
                </Fact>
              </Facts>
              {d.event.description && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {d.event.description}
                </p>
              )}
              {d.event.is_public && d.event.public_slug && (
                <p className="mt-4 text-sm">
                  <a
                    className="underline underline-offset-4"
                    href={`/e/${d.event.public_slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Public RSVP page
                  </a>{' '}
                  <span className="text-muted-foreground">— no account needed to sign up.</span>
                </p>
              )}
            </div>

            <Section title="Getting in" className="mt-8">
              <ul className="space-y-1.5">
                {ACCESS.map(({ key, label, icon: Icon }) => {
                  const v = d.event[key];
                  return (
                    <li key={key} className="flex items-center gap-2.5 text-sm">
                      <Icon
                        aria-hidden
                        className={cn(
                          'h-4 w-4',
                          v === true
                            ? 'text-teal'
                            : v === false
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                        )}
                      />
                      <span>{label}</span>
                      <span
                        className={cn('ml-auto', v === null ? 'text-muted-foreground' : 'font-medium')}
                      >
                        {v === true ? 'Yes' : v === false ? 'No' : 'Nobody has said'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {d.event.access_notes && (
                <p className="mt-3 text-sm text-muted-foreground">{d.event.access_notes}</p>
              )}
            </Section>

            <Section title="Shifts" className="mt-8" hint={d.shifts.length ? undefined : 'None yet.'}>
              {d.shifts.length > 0 && (
                <ul className="paper divide-y">
                  {d.shifts.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {clock(s.starts_at)} – {clock(s.ends_at)}
                      </span>
                      <span className="ml-auto text-sm tabular-nums">
                        {s.filled}/{s.slots}
                      </span>
                      {s.filled < s.slots && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={signUp.isPending}
                          onClick={() => signUp.mutate(s.id)}
                        >
                          Take it
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addShift.mutate(new FormData(e.currentTarget));
                    e.currentTarget.reset();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="s-name">Shift</Label>
                    <Input id="s-name" name="name" placeholder="Door" className="w-36" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-from">From</Label>
                    <Input id="s-from" name="from" type="time" defaultValue="18:00" className="w-32" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-to">To</Label>
                    <Input id="s-to" name="to" type="time" defaultValue="20:00" className="w-32" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-slots">People</Label>
                    <Input
                      id="s-slots"
                      name="slots"
                      type="number"
                      min={1}
                      defaultValue={2}
                      className="w-20"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="outline" disabled={addShift.isPending}>
                    Add
                  </Button>
                </form>
              )}
            </Section>

            {(needRides.length > 0 || offerRides.length > 0 || childcare.length > 0) && (
              <Section title="Getting there" className="mt-8">
                <div className="space-y-2 text-sm">
                  {needRides.length > 0 && (
                    <p className="flex items-start gap-2">
                      <Car aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <span>
                        <strong className="font-medium">{needRides.length} need a ride:</strong>{' '}
                        {needRides.map((r) => r.display_name).join(', ')}
                      </span>
                    </p>
                  )}
                  {offerRides.length > 0 && (
                    <p className="flex items-start gap-2">
                      <Car aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                      <span>
                        <strong className="font-medium">
                          {offerRides.reduce((n, r) => n + (r.ride_seats ?? 0), 0)} seats offered:
                        </strong>{' '}
                        {offerRides.map((r) => r.display_name).join(', ')}
                      </span>
                    </p>
                  )}
                  {childcare.length > 0 && (
                    <p className="text-muted-foreground">
                      {childcare.reduce((n, r) => n + (r.childcare_children ?? 0), 0)} children need
                      minding.
                    </p>
                  )}
                </div>
              </Section>
            )}

            <Section title={`Who is coming (${d.rsvps.length})`} className="mt-8">
              {d.rsvps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nobody has replied yet — or your role does not show individual names, in which
                  case the count above the fold is what you get.
                </p>
              ) : (
                <ul className="paper divide-y">
                  {d.rsvps.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                      <span>{r.display_name}</span>
                      {r.guest_count > 0 && (
                        <span className="text-sm text-muted-foreground">+{r.guest_count}</span>
                      )}
                      {r.access_needs && (
                        <span className="text-sm text-muted-foreground">{r.access_needs}</span>
                      )}
                      <Badge
                        variant={r.status === 'going' ? 'outline' : 'secondary'}
                        className="ml-auto font-normal"
                      >
                        {r.checked_in ? 'arrived' : r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {canEdit && !d.event.cancelled_at && (
              <div className="mt-8 border-t pt-5">
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (
                      window.confirm(`Cancel "${d.event.title}"? Everyone who RSVPd should be told.`)
                    ) {
                      cancel.mutate();
                    }
                  }}
                >
                  Cancel this event
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NewEvent() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) => {
      /** Unticked means "nobody has said", not "no" — see accessibilitySchema. */
      const tri = (name: string) => (form.get(name) === 'on' ? true : undefined);
      return post('/events', {
        title: String(form.get('title') ?? '').trim(),
        description: String(form.get('description') ?? '').trim() || undefined,
        startsAt: new Date(String(form.get('startsAt'))).toISOString(),
        locationName: String(form.get('locationName') ?? '').trim() || undefined,
        capacity: Number(form.get('capacity')) || undefined,
        isPublic: form.get('isPublic') === 'on',
        accessTransit: tri('accessTransit'),
        accessStepFree: tri('accessStepFree'),
        accessAsl: tri('accessAsl'),
        accessQuietSpace: tri('accessQuietSpace'),
        accessNotes: String(form.get('accessNotes') ?? '').trim() || undefined,
      });
    },
    onSuccess: () => {
      say('Scheduled.');
      void client.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not scheduled', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus className="mr-2 h-4 w-4" />
          New event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>
            Tick only what you know to be true. An unticked box reads as “nobody has said”, not as
            “no”.
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
            <Label htmlFor="title">What is it</Label>
            <Input id="title" name="title" required placeholder="Rent board hearing" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startsAt">When</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" name="capacity" type="number" min={1} placeholder="No limit" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="locationName">Where</Label>
            <Input id="locationName" name="locationName" placeholder="City Hall, chamber B" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Anything else</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>

          <fieldset className="space-y-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Getting in</legend>
            {[
              ['accessTransit', 'Reachable on transit'],
              ['accessStepFree', 'Step-free access'],
              ['accessAsl', 'ASL interpretation'],
              ['accessQuietSpace', 'A quiet space'],
            ].map(([name, label]) => (
              <label key={name} className="flex items-center gap-2.5 text-sm">
                <Checkbox name={name} />
                {label}
              </label>
            ))}
            <div className="space-y-2 pt-2">
              <Label htmlFor="accessNotes">Notes</Label>
              <Textarea
                id="accessNotes"
                name="accessNotes"
                rows={2}
                placeholder="Lift is out of order; ask at the desk for the ramp entrance."
              />
            </div>
          </fieldset>

          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox name="isPublic" />
            Give it a public page anyone can RSVP from
          </label>

          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Scheduling…' : 'Schedule it'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
