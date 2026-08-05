/**
 * Consilium (§5.8) — the module no competitor ships.
 *
 * The thing that makes this hard to fake is the secret ballot. A vote is cast
 * against a blinded token, so the server can prove that a valid member voted
 * once and cannot say who they are. That has a consequence this screen has to
 * honour: while a secret ballot is open there is no running count to show. Most
 * products would show one anyway, computed from the rows they hold. We hold
 * rows that do not link to a person, and a live tally would invite someone to
 * correlate it against who has opened their email.
 *
 * So an open secret ballot shows turnout and nothing else, and says why.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ListOrdered, ScrollText, Vote } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { Figure, Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { api, day, post, when, words, type ProposalRow, type Workspace } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';

const MODULE = MODULES.find((m) => m.path === '/governance')!;

const METHODS = [
  ['consensus', 'Consensus — a block stops it'],
  ['modified_consensus', 'Modified consensus — blocks counted, then a threshold'],
  ['simple_majority', 'Simple majority'],
  ['supermajority', 'Supermajority (two thirds)'],
  ['ranked_choice', 'Ranked choice'],
] as const;

const CHOICES = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['abstain', 'Abstain'],
  ['stand_aside', 'Stand aside'],
  ['block', 'Block'],
] as const;

interface Ballot {
  id: string;
  method: string;
  is_secret: boolean;
  closes_at: string;
  closed_at: string | null;
  result: string | null;
  eligible_count: number | null;
}

interface ProposalDetail {
  proposal: { id: string; title: string; body: string; status: string; created_at: string };
  comments: { id: string; body: string; created_at: string }[];
  amendments: { id: string; body: string; rationale: string | null; status: string }[];
  ballots: Ballot[];
}

interface Tally {
  open: boolean;
  secret: boolean;
  turnout?: number;
  eligible: number;
  tallyWithheld?: string;
  tally?: Record<string, number>;
  result?: { outcome: string; reason: string };
  options?: string[];
  runoff?: { rounds: { counts: number[]; eliminated: number | null }[]; winner: number | null };
}

export function Governance() {
  const [openId, setOpenId] = useState<string | null>(null);
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const proposals = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api<ProposalRow[]>('/consilium/proposals'),
  });
  const bylaws = useQuery({
    queryKey: ['bylaws'],
    queryFn: () => api<{ id: string; title: string; current_version: number | null }[]>('/consilium/bylaws'),
    retry: false,
  });
  const canPropose = workspace.data?.me.role !== 'observer';

  if (openId) return <Proposal id={openId} canVote={canPropose} onBack={() => setOpenId(null)} />;

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Governance"
        description="Proposals, quorum, and votes the server cannot trace back to a person. The bylaws vault keeps every version, so “that is not what we agreed” has an answer."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/governance/facilitate">
                <ListOrdered className="mr-2 h-4 w-4" />
                Run a meeting
              </Link>
            </Button>
            {canPropose && <NewProposal />}
          </>
        }
      />

      {proposals.isLoading ? (
        <Loading rows={3} label="Loading proposals" />
      ) : proposals.isError ? (
        <Failed error={proposals.error} what="We could not load the proposals" />
      ) : proposals.data?.length === 0 ? (
        <Empty
          title="Nothing before the group"
          reason="A proposal starts a discussion thread. When it is ready, open a ballot on it — consensus, majority, supermajority or ranked choice, with the quorum your bylaws set."
          action={canPropose ? <NewProposal /> : undefined}
        />
      ) : (
        <ul className="mb-10 space-y-3">
          {proposals.data?.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="paper block w-full px-5 py-4 text-left hover:border-tone/50"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-xl">{p.title}</span>
                  <Badge
                    variant={p.status === 'adopted' ? 'outline' : 'secondary'}
                    className="font-normal"
                  >
                    {words(p.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.comments} comment{p.comments === 1 ? '' : 's'}
                  {p.decided_at ? ` · decided ${day(p.decided_at)}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Section title="Bylaws" hint="Every version kept, with the date it changed.">
        {bylaws.data?.length ? (
          <ul className="paper divide-y">
            {bylaws.data.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                <ScrollText aria-hidden className="h-4 w-4 text-deep" />
                <span className="font-medium">{b.title}</span>
                <span className="ml-auto text-sm text-muted-foreground">
                  {b.current_version ? `version ${b.current_version}` : 'no versions yet'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No bylaws filed. A group that writes them down argues about them less.
          </p>
        )}
      </Section>

      <Guarantee>
        A secret ballot is cast against a blinded token. Coram can prove a member voted once and
        cannot tell you which way — not for a steward, not for us, not for a court.
      </Guarantee>
    </>
  );
}

function Proposal({ id, canVote, onBack }: { id: string; canVote: boolean; onBack: () => void }) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ['proposal', id],
    queryFn: () => api<ProposalDetail>(`/consilium/proposals/${id}`),
  });

  const comment = useMutation({
    mutationFn: (body: string) => post(`/consilium/proposals/${id}/comments`, { body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['proposal', id] });
      void client.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (e: Error) => failed('Not posted', e),
  });

  const d = detail.data;
  const live = d?.ballots.find((b) => !b.closed_at);

  return (
    <>
      <PageHeader
        module={MODULE}
        title={d?.proposal.title ?? 'Loading…'}
        description={d && `${words(d.proposal.status)} · raised ${day(d.proposal.created_at)}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              All proposals
            </Button>
            {canVote && d && !live && <NewBallot proposalId={id} />}
          </>
        }
      />

      {detail.isLoading && <Loading rows={4} />}
      {detail.isError && <Failed error={detail.error} />}

      {d && (
        <>
          <Section>
            <div className="paper px-5 py-4">
              <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{d.proposal.body}</p>
            </div>
          </Section>

          {d.ballots.map((b) => (
            <BallotPanel key={b.id} ballot={b} canVote={canVote} proposalId={id} />
          ))}

          {d.amendments.length > 0 && (
            <Section title="Amendments">
              <ul className="paper divide-y">
                {d.amendments.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex items-baseline gap-3">
                      <p className="min-w-0 flex-1 text-[0.95rem]">{a.body}</p>
                      <Badge variant="secondary" className="font-normal">
                        {words(a.status)}
                      </Badge>
                    </div>
                    {a.rationale && (
                      <p className="mt-1 text-sm text-muted-foreground">{a.rationale}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`Discussion (${d.comments.length})`}>
            {d.comments.length > 0 && (
              <ul className="mb-4 space-y-2">
                {d.comments.map((c) => (
                  <li key={c.id} className="paper px-5 py-3">
                    <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{c.body}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{when(c.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
            {canVote && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = String(new FormData(e.currentTarget).get('body') ?? '').trim();
                  if (body) comment.mutate(body);
                  e.currentTarget.reset();
                }}
              >
                <Label htmlFor="body" className="sr-only">
                  Say something
                </Label>
                <Textarea id="body" name="body" rows={3} placeholder="Say something" />
                <Button type="submit" size="sm" className="mt-2" disabled={comment.isPending}>
                  Post
                </Button>
              </form>
            )}
          </Section>
        </>
      )}
    </>
  );
}

function BallotPanel({
  ballot,
  canVote,
  proposalId,
}: {
  ballot: Ballot;
  canVote: boolean;
  proposalId: string;
}) {
  const client = useQueryClient();
  const tally = useQuery({
    queryKey: ['tally', ballot.id],
    queryFn: () => api<Tally>(`/consilium/ballots/${ballot.id}/tally`),
  });

  const cast = useMutation({
    mutationFn: (choice: string) => post(`/consilium/ballots/${ballot.id}/cast`, { choice }),
    onSuccess: () => {
      say('Your vote is in.');
      void client.invalidateQueries({ queryKey: ['tally', ballot.id] });
      void client.invalidateQueries({ queryKey: ['proposal', proposalId] });
    },
    onError: (e: Error) => failed('Not recorded', e),
  });

  const t = tally.data;
  const open = !ballot.closed_at;

  return (
    <Section
      title={`Ballot — ${words(ballot.method)}`}
      hint={
        open
          ? `Closes ${when(ballot.closes_at)}${ballot.is_secret ? ' · secret' : ' · recorded'}`
          : `Closed ${day(ballot.closed_at!)}`
      }
    >
      <div className="paper px-5 py-4">
        {tally.isLoading && <Loading rows={1} />}

        {t?.tallyWithheld ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Figure value={t.turnout ?? 0} label="Votes cast" />
              <Figure value={t.eligible} label="Eligible" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.tallyWithheld}</p>
          </>
        ) : t?.tally ? (
          <>
            <ul className="space-y-1.5">
              {Object.entries(t.tally).map(([choice, n]) => (
                <li key={choice} className="flex items-baseline justify-between text-[0.95rem]">
                  <span>{words(choice)}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
            {t.result && (
              <p className="mt-4 border-t pt-3 text-[0.95rem]">
                <span className="font-medium">{words(t.result.outcome)}</span>
                <span className="text-muted-foreground"> — {t.result.reason}</span>
              </p>
            )}
          </>
        ) : t?.runoff ? (
          <ol className="space-y-2 text-sm">
            {t.runoff.rounds.map((r, i) => (
              <li key={i}>
                <span className="font-medium">Round {i + 1}:</span>{' '}
                {r.counts
                  .map((n, opt) => `${t.options?.[opt] ?? `option ${opt + 1}`} ${n}`)
                  .join(' · ')}
                {r.eliminated !== null && (
                  <span className="text-muted-foreground">
                    {' '}
                    — {t.options?.[r.eliminated]} eliminated
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : null}

        {open && canVote && !ballot.is_secret && (
          <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
            {CHOICES.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={value === 'block' ? 'destructive' : 'outline'}
                disabled={cast.isPending}
                onClick={() => cast.mutate(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        {open && ballot.is_secret && (
          <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
            Every eligible member was sent their own voting link. It is the only way to cast a vote
            on this ballot, and it is not recoverable from here — that is what makes it secret.
          </p>
        )}
      </div>
    </Section>
  );
}

function NewProposal() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/consilium/proposals', {
        title: String(form.get('title') ?? '').trim(),
        body: String(form.get('body') ?? '').trim(),
      }),
    onSuccess: () => {
      say('Raised.');
      void client.invalidateQueries({ queryKey: ['proposals'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not raised', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Raise a proposal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a proposal</DialogTitle>
          <DialogDescription>
            It opens in discussion. Nothing is voted on until someone opens a ballot.
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
            <Label htmlFor="p-title">Title</Label>
            <Input id="p-title" name="title" required placeholder="Endorse the repairs ordinance" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-body">What is being proposed</Label>
            <Textarea id="p-body" name="body" rows={7} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Raising…' : 'Raise it'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewBallot({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/consilium/ballots', {
        proposalId,
        method: String(form.get('method')),
        isSecret: form.get('secrecy') === 'secret',
        closesAt: new Date(
          Date.now() + Number(form.get('days') ?? 7) * 86_400_000,
        ).toISOString(),
        quorum: { numerator: 1, denominator: 2 },
        threshold: { numerator: 1, denominator: 2 },
        options: [],
      }),
    onSuccess: () => {
      say('Ballot open.');
      void client.invalidateQueries({ queryKey: ['proposal', proposalId] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Ballot not opened', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Vote className="mr-2 h-4 w-4" />
          Open a ballot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a ballot</DialogTitle>
          <DialogDescription>
            A secret ballot needs a way to send every member their own link. If delivery is not
            configured, Coram refuses rather than opening a ballot nobody can vote in.
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
            <Label htmlFor="b-method">How it is decided</Label>
            <Select name="method" defaultValue="simple_majority">
              <SelectTrigger id="b-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-secrecy">Secrecy</Label>
              <Select name="secrecy" defaultValue="recorded">
                <SelectTrigger id="b-secrecy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recorded">Recorded — names against votes</SelectItem>
                  <SelectItem value="secret">Secret — blinded tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-days">Open for</Label>
              <Input id="b-days" name="days" type="number" min={1} defaultValue={7} />
            </div>
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
