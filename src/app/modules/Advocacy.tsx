/**
 * Petitio (§5.5) — writing the law you want, and finding someone to file it.
 *
 * The read-only version of this screen was the clearest symptom of what was
 * wrong with the app: the API can create a bill, rewrite its sections, record
 * endorsements and log what an office said back, and the UI could do none of
 * those things. All four are here now.
 *
 * Three rules the interface has to keep:
 *
 *   - The section review is advice, never a gate. A group is allowed to file
 *     something we think is incomplete; we are not the counsel of record.
 *   - The sponsor list is not a ranking. It is a public roster with its
 *     limitations printed beside it, because a "top match" implies a tie
 *     strength we deliberately do not compute and would not store.
 *   - A signature threshold is shown with its expiry. Most states recompute
 *     from the last qualifying election, so a number without a date is a number
 *     that will quietly become wrong on a Tuesday in November.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FilePlus2, Info } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { Fact, Facts, Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { api, day, patch, post, put, words, type BillRow, type Workspace } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';

const MODULE = MODULES.find((m) => m.path === '/advocacy')!;

const STAGES = [
  'drafting',
  'seeking_sponsor',
  'sponsored',
  'filed',
  'in_committee',
  'passed',
  'failed',
  'withdrawn',
] as const;

const OUTCOMES = [
  'requested',
  'scheduled',
  'met',
  'declined',
  'no_response',
  'committed',
  'refused',
] as const;

interface BillSection {
  kind: string;
  position: number;
  heading: string | null;
  body: string;
}

interface BillDetail {
  bill: BillRow & { problem: string | null; intent: string | null };
  sections: BillSection[];
  endorsements: { id: string; org_name: string; org_url: string | null; public: boolean; note: string | null }[];
  issues: { section?: string; message: string }[];
  ready: boolean;
  routes: { kind: string; title: string; detail: string; draftingHelp: string | null }[];
}

interface Sponsors {
  jurisdiction: string;
  committees: { id: string; name: string; chamber: string }[];
  legislators: { id: string; name: string; party: string | null; chamber: string; district: string | null }[];
  sources: { source: string; status: string; ageDays: number | null }[];
  limitations: string[];
}

interface OutreachRow {
  id: string;
  office_name: string;
  outcome: string;
  occurred_on: string;
  note: string | null;
}

export function Advocacy() {
  const [openId, setOpenId] = useState<string | null>(null);
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const bills = useQuery({ queryKey: ['bills'], queryFn: () => api<BillRow[]>('/petitio/bills') });
  const canEdit = ['steward', 'organizer'].includes(workspace.data?.me.role ?? '');

  if (openId) {
    return <Bill id={openId} canEdit={canEdit} onBack={() => setOpenId(null)} />;
  }

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Advocacy"
        description="Most groups never write the law they want because nobody tells them how. This walks the whole route: draft it, check it reads like statute, find who can file it, and record what each office said."
        actions={canEdit && <NewBill />}
      />

      {bills.isLoading ? (
        <Loading rows={3} label="Loading bills" />
      ) : bills.isError ? (
        <Failed error={bills.error} what="We could not load your drafts" />
      ) : bills.data?.length === 0 ? (
        <Empty
          title="No drafts yet"
          reason="Start from the problem in your own words. Coram fills in the scaffold — short title, enacting clause, definitions, operative sections — and tells you which parts are still missing."
          action={canEdit ? <NewBill /> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {bills.data?.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setOpenId(b.id)}
                className="paper block w-full px-5 py-4 text-left hover:border-tone/50"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-xl">{b.working_name}</span>
                  <Badge variant="outline" className="border-deep/40 font-normal text-deep">
                    {words(b.stage)}
                  </Badge>
                  {b.filed_as && <Badge variant="secondary">{b.filed_as}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {b.jurisdiction}
                  {b.locality ? ` · ${b.locality}` : ''} · {words(b.route)} route · {b.sections}{' '}
                  sections · {b.endorsements} endorsements
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// One bill
// ---------------------------------------------------------------------------

function Bill({ id, canEdit, onBack }: { id: string; canEdit: boolean; onBack: () => void }) {
  const client = useQueryClient();
  const detail = useQuery({ queryKey: ['bill', id], queryFn: () => api<BillDetail>(`/petitio/bills/${id}`) });
  const sponsors = useQuery({
    queryKey: ['sponsors', id],
    queryFn: () => api<Sponsors>(`/petitio/bills/${id}/sponsors`),
  });
  const outreach = useQuery({
    queryKey: ['outreach', id],
    queryFn: () => api<OutreachRow[]>(`/petitio/bills/${id}/outreach`),
  });

  const setStage = useMutation({
    mutationFn: (stage: string) => patch(`/petitio/bills/${id}`, { stage }),
    onSuccess: () => {
      say('Stage updated.');
      void client.invalidateQueries({ queryKey: ['bill', id] });
      void client.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (e: Error) => failed('Not updated', e),
  });

  const d = detail.data;

  return (
    <>
      <PageHeader
        module={MODULE}
        title={d?.bill.working_name ?? 'Loading…'}
        description={
          d && (
            <>
              {d.bill.jurisdiction}
              {d.bill.locality ? ` · ${d.bill.locality}` : ''} · {words(d.bill.route)} route
            </>
          )
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              All drafts
            </Button>
            {canEdit && d && (
              <Select value={d.bill.stage} onValueChange={(v) => setStage.mutate(v)}>
                <SelectTrigger className="w-44" aria-label="Stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {words(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      {detail.isLoading && <Loading rows={5} />}
      {detail.isError && <Failed error={detail.error} />}

      {d && (
        <Tabs defaultValue="text">
          <TabsList className="mb-6">
            <TabsTrigger value="text">The bill</TabsTrigger>
            <TabsTrigger value="route">Route</TabsTrigger>
            <TabsTrigger value="sponsors">Who can file it</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            {d.issues.length > 0 && (
              <div className="mb-6 rounded-lg border border-gold/40 bg-gold/[0.08] px-5 py-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Info aria-hidden className="h-4 w-4 text-gold" />
                  {d.ready ? 'Structurally complete, with notes' : 'Still missing pieces'}
                </p>
                <ul className="mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground">
                  {d.issues.map((i, n) => (
                    <li key={n}>
                      {i.section ? <span className="font-medium">{words(i.section)}: </span> : null}
                      {i.message}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Advice, not a gate. You can file whatever you like — we are not the counsel of
                  record and this list does not stop anything.
                </p>
              </div>
            )}

            {d.bill.problem && (
              <Section title="The problem, in your words">
                <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{d.bill.problem}</p>
              </Section>
            )}

            <SectionEditor id={id} sections={d.sections} canEdit={canEdit} />

            <p className="mt-4 text-sm">
              <a className="underline underline-offset-4" href={`/api/petitio/bills/${id}/text`}>
                Download the whole thing as plain text
              </a>{' '}
              <span className="text-muted-foreground">— what you would email to an office.</span>
            </p>
          </TabsContent>

          <TabsContent value="route">
            <Section
              title="How this can reach a legislature"
              hint={`What is actually available in ${d.bill.jurisdiction}, not the three routes everybody assumes.`}
            >
              <ul className="space-y-3">
                {d.routes.map((r) => (
                  <li key={r.kind} className="paper px-5 py-4">
                    <p className="font-display text-lg">{r.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
                    {r.draftingHelp && (
                      <p className="mt-2 border-l-2 border-tone/60 pl-3 text-sm leading-relaxed">
                        {r.draftingHelp}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
            <Pathway code={d.bill.jurisdiction} />
          </TabsContent>

          <TabsContent value="sponsors">
            {sponsors.isLoading && <Loading rows={4} />}
            {sponsors.isError && <Failed error={sponsors.error} />}
            {sponsors.data && (
              <>
                <Section
                  title="Offices"
                  hint="A public roster in the order the source publishes it. Not a ranking."
                >
                  {sponsors.data.committees.length > 0 && (
                    <ul className="paper mb-4 divide-y">
                      {sponsors.data.committees.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-auto text-sm text-muted-foreground">{c.chamber}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {sponsors.data.legislators.length > 0 ? (
                    <ul className="paper divide-y">
                      {sponsors.data.legislators.slice(0, 40).map((l) => (
                        <li key={l.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5">
                          <span className="font-medium">{l.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {l.party ?? '—'} · {l.chamber}
                            {l.district ? ` · district ${l.district}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      We have no roster for this jurisdiction yet.
                    </p>
                  )}
                </Section>

                {sponsors.data.limitations.length > 0 && (
                  <Section title="What this list does not tell you">
                    <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                      {sponsors.data.limitations.map((l, n) => (
                        <li key={n}>{l}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section title="Where it came from">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {sponsors.data.sources.map((s) => (
                      <li key={s.source}>
                        {s.source} · {s.status}
                        {s.ageDays !== null ? ` · ${s.ageDays} days old` : ''}
                      </li>
                    ))}
                  </ul>
                </Section>

                <Guarantee>
                  Coram does not score legislators, does not keep notes on named staffers, and does
                  not compute a “likelihood to sponsor”. That would be a file on public officials
                  built out of a group’s private conversations, and it is the sort of thing that gets
                  subpoenaed.
                </Guarantee>
              </>
            )}

            <OutreachLog id={id} rows={outreach.data ?? []} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="support">
            <Endorsements id={id} rows={d.endorsements} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function SectionEditor({
  id,
  sections,
  canEdit,
}: {
  id: string;
  sections: BillSection[];
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<BillSection[] | null>(null);
  const rows = draft ?? sections;

  const save = useMutation({
    mutationFn: () =>
      put(`/petitio/bills/${id}/sections`, {
        sections: rows.map((s, i) => ({
          kind: s.kind,
          position: i,
          heading: s.heading,
          body: s.body,
        })),
      }),
    onSuccess: () => {
      say('Saved.');
      setDraft(null);
      void client.invalidateQueries({ queryKey: ['bill', id] });
      void client.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (e: Error) => failed('Not saved', e),
  });

  return (
    <Section
      title="The text"
      actions={
        canEdit && draft ? (
          <>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Save the text'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Discard
            </Button>
          </>
        ) : canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setDraft(sections)}>
            Edit
          </Button>
        ) : undefined
      }
    >
      <ol className="space-y-4">
        {rows.map((s, i) => (
          <li key={`${s.kind}-${i}`} className="paper px-5 py-4">
            <p className="eyebrow mb-2">{words(s.kind)}</p>
            {draft ? (
              <>
                <Input
                  aria-label={`Heading for section ${i + 1}`}
                  value={s.heading ?? ''}
                  onChange={(e) =>
                    setDraft(rows.map((r, n) => (n === i ? { ...r, heading: e.target.value } : r)))
                  }
                  className="mb-2 font-display text-lg"
                />
                <Textarea
                  aria-label={`Text of section ${i + 1}`}
                  value={s.body}
                  rows={Math.max(3, Math.ceil(s.body.length / 90))}
                  onChange={(e) =>
                    setDraft(rows.map((r, n) => (n === i ? { ...r, body: e.target.value } : r)))
                  }
                />
              </>
            ) : (
              <>
                {s.heading && <p className="font-display text-lg">{s.heading}</p>}
                <p className="mt-1 whitespace-pre-wrap text-[0.95rem] leading-relaxed">
                  {s.body || (
                    <span className="text-muted-foreground">Nothing written here yet.</span>
                  )}
                </p>
              </>
            )}
          </li>
        ))}
      </ol>
      {draft && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            setDraft([
              ...rows,
              { kind: 'operative', position: rows.length, heading: 'Operative section', body: '' },
            ])
          }
        >
          Add an operative section
        </Button>
      )}
    </Section>
  );
}

function Endorsements({
  id,
  rows,
  canEdit,
}: {
  id: string;
  rows: BillDetail['endorsements'];
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const add = useMutation({
    mutationFn: (form: FormData) =>
      post(`/petitio/bills/${id}/endorsements`, {
        orgName: String(form.get('orgName') ?? '').trim(),
        orgUrl: String(form.get('orgUrl') ?? '').trim() || undefined,
        public: form.get('public') === 'public',
        note: String(form.get('note') ?? '').trim() || undefined,
      }),
    onSuccess: () => {
      say('Recorded.');
      void client.invalidateQueries({ queryKey: ['bill', id] });
    },
    onError: (e: Error) => failed('Not recorded', e),
  });

  return (
    <Section
      title="Who is behind it"
      hint="An endorsement gathered privately is not a press release. Public is off unless you say so."
    >
      {rows.length > 0 ? (
        <ul className="paper mb-4 divide-y">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5">
              <span className="font-medium">{e.org_name}</span>
              {e.org_url && (
                <a
                  className="text-sm underline underline-offset-4"
                  href={e.org_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  site
                </a>
              )}
              <Badge variant={e.public ? 'outline' : 'secondary'} className="ml-auto font-normal">
                {e.public ? 'may be named' : 'private'}
              </Badge>
              {e.note && <p className="w-full text-sm text-muted-foreground">{e.note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">Nobody recorded yet.</p>
      )}

      {canEdit && (
        <form
          className="space-y-3 rounded-lg border border-dashed p-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(new FormData(e.currentTarget));
            e.currentTarget.reset();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Organisation</Label>
              <Input id="orgName" name="orgName" required placeholder="Riverside Mutual Aid" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgUrl">Website</Label>
              <Input id="orgUrl" name="orgUrl" type="url" placeholder="https://" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-public">May we name them publicly?</Label>
            <Select name="public" defaultValue="private">
              <SelectTrigger id="e-public" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">No — keep this internal</SelectItem>
                <SelectItem value="public">Yes — they agreed to be named</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-note">Note</Label>
            <Input id="e-note" name="note" placeholder="Board voted to endorse on the 12th" />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={add.isPending}>
            Add
          </Button>
        </form>
      )}
    </Section>
  );
}

function OutreachLog({
  id,
  rows,
  canEdit,
}: {
  id: string;
  rows: OutreachRow[];
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const add = useMutation({
    mutationFn: (form: FormData) =>
      post(`/petitio/bills/${id}/outreach`, {
        officeRef: String(form.get('officeName') ?? '').trim(),
        officeName: String(form.get('officeName') ?? '').trim(),
        outcome: String(form.get('outcome') ?? 'requested'),
        occurredOn: String(form.get('occurredOn')),
        note: String(form.get('note') ?? '').trim() || undefined,
      }),
    onSuccess: () => {
      say('Logged.');
      void client.invalidateQueries({ queryKey: ['outreach', id] });
    },
    onError: (e: Error) => failed('Not logged', e),
  });

  return (
    <Section title="What each office said" className="mt-10">
      {rows.length > 0 ? (
        <ul className="paper mb-4 divide-y">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
              <span className="font-medium">{o.office_name}</span>
              <Badge variant="outline" className="font-normal">
                {words(o.outcome)}
              </Badge>
              <span className="ml-auto text-sm text-muted-foreground">{day(o.occurred_on)}</span>
              {o.note && <p className="w-full text-sm text-muted-foreground">{o.note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">Nothing logged yet.</p>
      )}

      {canEdit && (
        <form
          className="space-y-3 rounded-lg border border-dashed p-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(new FormData(e.currentTarget));
            e.currentTarget.reset();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="officeName">Office</Label>
              <Input id="officeName" name="officeName" required placeholder="Rep. Alvarez, district 18" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occurredOn">When</Label>
              <Input
                id="occurredOn"
                name="occurredOn"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outcome">What happened</Label>
            <Select name="outcome" defaultValue="requested">
              <SelectTrigger id="outcome" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {words(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="o-note">Note</Label>
            <Input id="o-note" name="note" placeholder="Wants a fiscal note before committing" />
            <p className="text-xs text-muted-foreground">
              About the ask and the answer. Not about the person — this field is short on purpose.
            </p>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={add.isPending}>
            Log it
          </Button>
        </form>
      )}
    </Section>
  );
}

/** The jurisdiction's own rules, with the date its numbers stop being true. */
function Pathway({ code }: { code: string }) {
  const p = useQuery({
    queryKey: ['pathway', code],
    queryFn: () =>
      api<{
        pathway: {
          name: string;
          statute: string;
          constitutional: string;
          referendum: boolean;
          statuteCount: number | null;
          statuteFormula: string | null;
          countUnknowableBecause: string | null;
          asOf: string;
        };
        signatures: { kind: string; count: number | null; formula: string | null; note: string | null };
        freshness: { stale: boolean; note: string; resetAfter: string };
      }>(`/petitio/pathways/${code}`),
  });

  if (!p.data) return null;
  const { pathway, signatures, freshness } = p.data;

  return (
    <Section title={`${pathway.name}: the mechanics`}>
      <div className="paper px-5 py-4">
        <Facts>
          <Fact term="Citizen statute">
            {pathway.statute === 'none' ? 'No such mechanism here' : words(pathway.statute)}
          </Fact>
          <Fact term="Constitutional">
            {pathway.constitutional === 'none' ? 'No' : words(pathway.constitutional)}
          </Fact>
          <Fact term="Veto referendum">{pathway.referendum ? 'Yes' : 'No'}</Fact>
          <Fact term="Signatures">
            {signatures.kind === 'fixed' && signatures.count
              ? signatures.count.toLocaleString('en-US')
              : signatures.kind === 'unknowable'
                ? 'No number can exist yet'
                : signatures.kind === 'none'
                  ? 'Not applicable'
                  : 'Unverified — check locally'}
          </Fact>
        </Facts>
        {signatures.formula && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{signatures.formula}</p>
        )}
        {pathway.countUnknowableBecause && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {pathway.countUnknowableBecause}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Researched {day(pathway.asOf)}. {freshness.note} Signature thresholds are recomputed from the
        last qualifying election in most states, so every figure here needs confirming after{' '}
        {freshness.resetAfter} — including the ones that do not move.
      </p>
    </Section>
  );
}

function NewBill() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const pathways = useQuery({
    queryKey: ['pathways'],
    queryFn: () => api<{ code: string; name: string }[]>('/petitio/pathways'),
  });

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/petitio/bills', {
        workingName: String(form.get('workingName') ?? '').trim(),
        jurisdiction: String(form.get('jurisdiction')),
        locality: String(form.get('locality') ?? '').trim() || undefined,
        route: String(form.get('route')),
        problem: String(form.get('problem') ?? '').trim() || undefined,
      }),
    onSuccess: () => {
      say('Started.', 'The scaffold is filled in — short title, enacting clause, definitions.');
      void client.invalidateQueries({ queryKey: ['bills'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not started', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FilePlus2 className="mr-2 h-4 w-4" />
          Start a bill
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a bill</DialogTitle>
          <DialogDescription>
            Describe the problem in your own words. Coram lays out the sections a bill needs and
            fills in what your jurisdiction prescribes.
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
            <Label htmlFor="workingName">Working name</Label>
            <Input id="workingName" name="workingName" required placeholder="The repairs ordinance" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Where</Label>
              <Select name="jurisdiction" defaultValue="CA">
                <SelectTrigger id="jurisdiction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {pathways.data?.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="route">Route</Label>
              <Select name="route" defaultValue="local">
                <SelectTrigger id="route">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">City or county ordinance</SelectItem>
                  <SelectItem value="state">State legislature</SelectItem>
                  <SelectItem value="initiative">Ballot initiative</SelectItem>
                  <SelectItem value="federal">Congress</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="locality">City or county</Label>
            <Input id="locality" name="locality" placeholder="Eastside" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="problem">What is wrong</Label>
            <Textarea
              id="problem"
              name="problem"
              rows={5}
              placeholder="Landlords here take months to fix heat and mould, and the only remedy is a lawsuit nobody can afford."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Starting…' : 'Start it'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
