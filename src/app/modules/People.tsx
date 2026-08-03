/**
 * Membra (§5.1) — the list every other module writes to.
 *
 * Three things here are not ordinary CRM behaviour and are deliberate:
 *
 *   - Reading this list writes an audit entry with a *count* and no values
 *     (§3.6). That is what lets a steward tell one lookup from someone paging
 *     the whole list, so the "who read this" line on the detail panel is not
 *     decoration — it is the thing that makes the guarantee checkable.
 *   - There is no field for date of birth, gender, employer, income or street
 *     address, and §3.7 puts several of those permanently out of bounds. The
 *     form does not have them because the schema does not have them because the
 *     table does not have them.
 *   - An empty list is not always an empty list. Turf and role scoping happen
 *     in the database, so "no contacts" and "none you may see" are different
 *     facts and this screen says which one it is.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Plus, Printer, Search, Upload } from 'lucide-react';

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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { failed, say } from '@/lib/notify';
import { Fact, Facts, PageHeader, Section } from '@/components/coram/Page';
import { Denied, Empty, Failed, Loading } from '@/components/coram/State';
import { api, day, del, patch, post, when, type ContactRow, type Workspace } from '@/lib/api';
import { MODULES } from '@/lib/modules';

const MODULE = MODULES.find((m) => m.path === '/people')!;

interface ConsentRow {
  id: string;
  channel: string;
  granted: boolean;
  acquisition: string;
  note: string | null;
  occurred_at: string;
}

export interface TurfRow {
  id: string;
  name: string;
  contacts: number;
  /** Whether this caller may file someone into it. */
  mine: boolean;
}

interface NoteRow {
  id: string;
  ciphertext: string;
  created_at: string;
}

export function People() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<ContactRow | null>(null);
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const role = workspace.data?.me.role;

  const contacts = useQuery({
    queryKey: ['contacts', q],
    queryFn: () => api<ContactRow[]>(`/contacts?${new URLSearchParams(q ? { q } : {})}`),
  });

  return (
    <>
      <PageHeader
        module={MODULE}
        title="People"
        description="Everyone the group knows, and how you came to know them. Nothing here that we would not want read out in court."
        actions={
          role !== 'observer' && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/people/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/people/sheet">
                  <Printer className="mr-2 h-4 w-4" />
                  Print a turf
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                {/* A plain link, not fetch: this is a file download and the
                    browser is better at those than we are. */}
                <a href="/api/exports/contacts.csv">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </a>
              </Button>
              <NewContact />
            </>
          )
        }
      />

      <div className="mb-5 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email or phone"
            aria-label="Search people"
            className="pl-9"
          />
        </div>
        {contacts.data && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {contacts.data.length}
            {contacts.data.length === 50 ? '+' : ''} shown
          </span>
        )}
      </div>

      {contacts.isLoading ? (
        <Loading rows={5} label="Loading people" />
      ) : contacts.isError ? (
        <Failed error={contacts.error} what="We could not load the list" />
      ) : contacts.data?.length === 0 ? (
        <EmptyList role={role} searching={Boolean(q)} />
      ) : (
        <div className="paper overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Last spoken to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.data?.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => setOpen(row)}
                  className="cursor-pointer"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setOpen(row);
                  }}
                >
                  <TableCell className="font-medium">
                    {row.display_name}
                    {/* Below sm the other columns are hidden, and a list of
                        bare names is not much of a list. The way to reach
                        someone belongs next to their name on a phone, which is
                        where an organizer is most likely to be reading it. */}
                    <span className="block text-sm font-normal text-muted-foreground sm:hidden">
                      {row.email ?? row.phone ?? 'No way to reach them on file'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {row.email ?? '—'}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {row.phone ?? '—'}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {row.last_interaction_at ? day(row.last_interaction_at) : 'Not yet'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ContactPanel contact={open} role={role} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * The two kinds of nothing, told apart.
 *
 * An observer sees no individual records by design and an organizer sees only
 * their turf. Rendering both as "no results" is how a working control gets
 * reported as a bug and then "fixed".
 */
function EmptyList({ role, searching }: { role?: string; searching: boolean }) {
  if (searching) {
    return <Empty title="Nobody matched that" reason="Try part of a name, an email, or a phone number." />;
  }
  if (role === 'observer') {
    return (
      <Denied
        what="Observers see totals, never people"
        why="Your workspace may have thousands of contacts; none of them are shown here and none can be. The denial happens at the database, not in this page, so there is nothing to switch on."
      />
    );
  }
  if (role === 'organizer') {
    return (
      <Empty
        title="No contacts in your turf"
        reason="You see the people assigned to you. If you expected someone here, a steward assigns turf under Workspace."
      />
    );
  }
  return (
    <Empty
      title="Nobody on the list yet"
      reason="Add someone by hand, or import a CSV — you will see exactly what the import will do before it does anything."
      action={
        <>
          <NewContact />
          <Button variant="outline" asChild>
            <Link to="/people/import">Import a CSV</Link>
          </Button>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function NewContact() {
  const [open, setOpen] = useState(false);
  const [turfId, setTurfId] = useState<string>();
  const client = useQueryClient();

  /*
   * The turf picker is not a convenience.
   *
   * contacts_insert admits an organizer only when the new row lands in a turf
   * they hold — "so they cannot create a row they would then be unable to see",
   * which is exactly right. With no field for it the insert was refused every
   * time, and adding a contact as an organizer was simply impossible. The
   * browser suite caught it; nothing local could have.
   */
  const turfs = useQuery({
    queryKey: ['turfs'],
    queryFn: () => api<TurfRow[]>('/workspace/turfs'),
    enabled: open,
  });
  const mine = (turfs.data ?? []).filter((t) => t.mine);

  /*
   * Held in state rather than read out of FormData on submit.
   *
   * The list arrives asynchronously, so for the first moment the dialog is open
   * there is no turf field at all — and a submit in that window sends no turf,
   * which the database refuses. The browser suite hit exactly that race: the
   * form was filled and submitted before the query resolved, the insert was
   * denied, and the only trace was a toast that had faded by the time anyone
   * looked. State plus a disabled button closes the window rather than making
   * it narrower.
   */
  useEffect(() => {
    if (!turfId && mine.length) setTurfId(mine[0].id);
  }, [mine, turfId]);

  const waiting = turfs.isLoading;

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/contacts', {
        displayName: String(form.get('displayName') ?? '').trim(),
        email: String(form.get('email') ?? '').trim() || undefined,
        phone: String(form.get('phone') ?? '').trim() || undefined,
        postalCode: String(form.get('postalCode') ?? '').trim() || undefined,
        turfId,
      }),
    onSuccess: () => {
      /*
       * refetchType: 'all', and it is load-bearing.
       *
       * By default invalidation refetches only *active, idle* queries. A list
       * request that was already in flight when the create landed is marked
       * stale and left alone — so its pre-create result is what stays on
       * screen, and with refetchOnWindowFocus off nothing ever comes back to
       * correct it. Add somebody while the list happens to be loading and they
       * simply are not there, until you type something else.
       *
       * The browser trace caught this: a search started 37ms after the POST and
       * no second request followed it. 'all' includes the in-flight one.
       */
      void client.invalidateQueries({ queryKey: ['contacts'], refetchType: 'all' });
      void client.invalidateQueries({ queryKey: ['workspace'] });
      void client.invalidateQueries({ queryKey: ['turfs'] });
      setOpen(false);
      setTurfId(undefined);
      say('Added.');
    },
    onError: (e: Error) => failed('Not added', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add someone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add someone</DialogTitle>
          <DialogDescription>
            A name, or an email, or a phone number — any one of the three is enough.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input id="displayName" name="displayName" autoComplete="off" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" autoComplete="off" />
            </div>
          </div>
          {mine.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="turfId">Turf</Label>
              <Select value={turfId} onValueChange={setTurfId}>
                <SelectTrigger id="turfId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mine.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {t.contacts} people
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only the turfs you hold. An organizer cannot file someone into a patch they
                could not then see — that rule is in the database, not in this form.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" name="postalCode" autoComplete="off" className="max-w-[10rem]" />
            {/* Said here rather than in a policy page, because here is where
                someone would otherwise go looking for the address field. */}
            <p className="text-xs text-muted-foreground">
              Postal code only. Coram has no field for a street address, a date of birth, an
              employer or an immigration status, and will not be getting one.
            </p>
          </div>
          {/*
            The API writes a better message than we would guess — "give at
            least a name, an email, or a phone number" — and a toast that has
            faded is not an error report. It stays on screen here.
          */}
          {create.isError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-2.5 text-sm"
            >
              {create.error instanceof Error ? create.error.message : 'That did not work.'}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={create.isPending || waiting}>
              {create.isPending ? 'Adding…' : waiting ? 'Loading turfs…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// The detail panel
// ---------------------------------------------------------------------------

function ContactPanel({
  contact,
  role,
  onClose,
}: {
  contact: ContactRow | null;
  role?: string;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const id = contact?.id;

  const consent = useQuery({
    queryKey: ['consent', id],
    queryFn: () => api<ConsentRow[]>(`/contacts/${id}/consent`),
    enabled: Boolean(id),
  });
  const notes = useQuery({
    queryKey: ['notes', id],
    queryFn: () => api<NoteRow[]>(`/contacts/${id}/notes`),
    enabled: Boolean(id),
  });
  const oneToOnes = useQuery({
    queryKey: ['one-to-ones', id],
    queryFn: () =>
      api<{ id: string; occurred_at: string; outcome_label: string | null; next_step: string | null }[]>(
        `/vinculum/contacts/${id}/one-to-ones`,
      ),
    enabled: Boolean(id),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (form: FormData) =>
      patch(`/contacts/${id}`, {
        displayName: String(form.get('displayName') ?? '').trim(),
        email: String(form.get('email') ?? '').trim() || undefined,
        phone: String(form.get('phone') ?? '').trim() || undefined,
        postalCode: String(form.get('postalCode') ?? '').trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['contacts'] });
      setEditing(false);
      say('Saved.');
    },
    onError: (e: Error) => failed('Not saved', e),
  });

  const remove = useMutation({
    mutationFn: () => del(`/contacts/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['contacts'] });
      onClose();
      say('Deleted', 'Gone from the list, and from every export after this one.');
    },
    onError: (e: Error) => failed('Not deleted', e),
  });

  const addConsent = useMutation({
    mutationFn: (form: FormData) =>
      post(`/contacts/${id}/consent`, {
        channel: String(form.get('channel')),
        granted: form.get('granted') === 'granted',
        acquisition: String(form.get('acquisition') ?? '').trim(),
        note: String(form.get('note') ?? '').trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['consent', id] });
      say('Recorded in the ledger.');
    },
    onError: (e: Error) => failed('Not recorded', e),
  });

  return (
    <Sheet open={Boolean(contact)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {contact && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-2xl">{contact.display_name}</SheetTitle>
            </SheetHeader>

            {editing ? (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate(new FormData(e.currentTarget));
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="e-name">Name</Label>
                  <Input id="e-name" name="displayName" defaultValue={contact.display_name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-email">Email</Label>
                  <Input id="e-email" name="email" type="email" defaultValue={contact.email ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-phone">Phone</Label>
                  <Input id="e-phone" name="phone" defaultValue={contact.phone ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-postal">Postal code</Label>
                  <Input id="e-postal" name="postalCode" defaultValue={contact.postal_code ?? ''} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={save.isPending}>
                    Save
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-6">
                  <Facts>
                    <Fact term="Email">{contact.email ?? 'None on file'}</Fact>
                    <Fact term="Phone">{contact.phone ?? 'None on file'}</Fact>
                    <Fact term="Postal code">{contact.postal_code ?? '—'}</Fact>
                    <Fact term="Last spoken to">
                      {contact.last_interaction_at ? day(contact.last_interaction_at) : 'Not yet'}
                    </Fact>
                  </Facts>
                  {role !== 'observer' && role !== 'member' && (
                    <div className="mt-5 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${contact.display_name}? Their consent history and notes go too. This cannot be undone.`,
                            )
                          ) {
                            remove.mutate();
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

                <Section title="Consent" className="mt-8" hint="How we came to have them, and what they said yes to.">
                  {consent.isLoading ? (
                    <Loading rows={1} />
                  ) : consent.data?.length ? (
                    <ul className="space-y-2">
                      {consent.data.map((r) => (
                        <li key={r.id} className="paper flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
                          <Badge variant={r.granted ? 'default' : 'destructive'} className="text-[0.65rem] uppercase">
                            {r.granted ? `${r.channel} — yes` : `${r.channel} — no`}
                          </Badge>
                          <span className="text-sm">{r.acquisition}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {day(r.occurred_at)}
                          </span>
                          {r.note && <p className="w-full text-sm text-muted-foreground">{r.note}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nothing recorded. A contact with no consent entry can still be reached by a
                      person, but not by a campaign.
                    </p>
                  )}

                  {role !== 'observer' && (
                    <form
                      className="mt-4 space-y-3 rounded-lg border border-dashed p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        addConsent.mutate(f);
                        e.currentTarget.reset();
                      }}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="c-channel">Channel</Label>
                          <Select name="channel" defaultValue="email">
                            <SelectTrigger id="c-channel">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['email', 'sms', 'phone', 'post', 'any'].map((ch) => (
                                <SelectItem key={ch} value={ch}>
                                  {ch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="c-granted">They</Label>
                          <Select name="granted" defaultValue="granted">
                            <SelectTrigger id="c-granted">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="granted">opted in</SelectItem>
                              <SelectItem value="withdrawn">opted out</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="c-acq">How we got them</Label>
                        <Input id="c-acq" name="acquisition" placeholder="Signed the clipboard at the March 4 meeting" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="c-note">Note</Label>
                        <Textarea id="c-note" name="note" rows={2} />
                      </div>
                      <Button type="submit" size="sm" variant="outline" disabled={addConsent.isPending}>
                        Record it
                      </Button>
                    </form>
                  )}
                </Section>

                {oneToOnes.data && oneToOnes.data.length > 0 && (
                  <Section title="Conversations" className="mt-8">
                    <ul className="space-y-2">
                      {oneToOnes.data.map((o) => (
                        <li key={o.id} className="paper px-4 py-2.5">
                          <p className="text-sm">
                            <span className="font-medium">{o.outcome_label ?? 'Talked'}</span>
                            <span className="text-muted-foreground"> · {day(o.occurred_at)}</span>
                          </p>
                          {o.next_step && <p className="mt-1 text-sm text-muted-foreground">{o.next_step}</p>}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section title="Organizer notes" className="mt-8">
                  {/*
                   * §3.3: these are sealed in the browser with a key derived
                   * from the steward's passphrase, and the server holds only
                   * ciphertext. That means this panel can honestly say how many
                   * notes exist and when they were written — the server knows
                   * that much — and cannot show a word of them without the
                   * passphrase. Metadata is not content; saying so is the point.
                   */}
                  {notes.data?.length ? (
                    <ul className="space-y-2">
                      {notes.data.map((n) => (
                        <li key={n.id} className="paper px-4 py-2.5 text-sm text-muted-foreground">
                          Sealed note · {when(n.created_at)} · {n.ciphertext.length} bytes of
                          ciphertext
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes on this person.</p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Notes are encrypted in your browser before they are sent. The server stores the
                    ciphertext and cannot read it — not for support, not for a subpoena. It does see
                    that a note exists, roughly how long it is, and when it was written.
                  </p>
                </Section>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
