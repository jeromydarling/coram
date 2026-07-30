/**
 * Thesaurus (§5.6) — dues, donations, and escrowed mutual aid.
 *
 * Two commitments are visible on this screen and are not configurable
 * anywhere:
 *
 *   - Coram takes 1% of general fundraising and dues, and **zero** on bail and
 *     mutual aid. §5.6 calls that a permanent product commitment and says not
 *     to make it a setting, so the take is shown per fund as a fact rather than
 *     as a field.
 *   - A disbursement needs two people. One requests, a different steward
 *     approves, and only then can it be paid. The button to approve your own
 *     request does not exist here because the database will not accept it.
 *
 * The purpose field is short on purpose. A bail disbursement naming its
 * recipient would put that person in a seven-year financial record, while §5.9
 * purges the jail-support case that prompted it after thirty days.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PiggyBank, ShieldCheck } from 'lucide-react';

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
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { api, day, money, post, words, type FundRow, type Workspace } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';
import { cn } from '@/lib/utils';

const MODULE = MODULES.find((m) => m.path === '/money')!;

type Fund = FundRow & {
  disbursed_cents: string;
  is_public: boolean;
  public_slug: string | null;
  takeDescription: string;
  contributors?: number;
};

interface Disbursement {
  id: string;
  fund_id: string;
  fund_name: string;
  kind: string;
  amount_cents: string;
  currency: string;
  purpose: string;
  status: string;
  created_at: string;
  approvals: number;
}

const KIND_LABEL: Record<string, string> = {
  general: 'General fundraising',
  dues: 'Dues',
  mutual_aid: 'Mutual aid',
  bail: 'Bail fund',
};

export function Money() {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const funds = useQuery({ queryKey: ['funds'], queryFn: () => api<Fund[]>('/funds') });
  const disbursements = useQuery({
    queryKey: ['disbursements'],
    queryFn: () => api<Disbursement[]>('/funds/disbursements'),
    retry: false,
  });
  const isSteward = workspace.data?.me.role === 'steward';

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Money"
        description="Where it came from, what is left, and who agreed to spend it. Bail and mutual aid pay Coram nothing — not a reduced rate, nothing."
        actions={isSteward && <NewFund />}
      />

      {funds.isLoading ? (
        <Loading rows={3} label="Loading funds" />
      ) : funds.isError ? (
        <Failed error={funds.error} what="We could not load the funds" />
      ) : funds.data?.length === 0 ? (
        <Empty
          title="No funds yet"
          reason="A fund is a pot with a purpose — dues, a general appeal, a mutual aid pot, or bail. The last two are free to run."
          action={isSteward ? <NewFund /> : undefined}
        />
      ) : (
        <ul className="mb-10 space-y-3">
          {funds.data?.map((f) => {
            const raised = Number(f.raised_cents);
            const goal = f.goal_cents ? Number(f.goal_cents) : null;
            const free = f.kind === 'bail' || f.kind === 'mutual_aid';
            return (
              <li key={f.id} className="paper px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-xl">{f.name}</span>
                  <Badge variant="secondary" className="font-normal">
                    {KIND_LABEL[f.kind] ?? words(f.kind)}
                  </Badge>
                  {free && (
                    <Badge variant="outline" className="border-teal/50 font-normal text-teal">
                      <ShieldCheck aria-hidden className="mr-1 h-3 w-3" />
                      no platform take
                    </Badge>
                  )}
                </div>

                <p className="mt-2 text-[0.95rem]">
                  <span className="font-medium tabular-nums">{money(raised, f.currency)}</span>
                  {goal ? (
                    <span className="text-muted-foreground"> of {money(goal, f.currency)}</span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {' · '}
                    {money(f.available_cents, f.currency)} unspent
                  </span>
                </p>

                {goal ? (
                  <Progress
                    value={Math.min(100, (raised / goal) * 100)}
                    className={cn('mt-3 h-1.5', free ? '[&>div]:bg-teal' : '[&>div]:bg-gold')}
                    aria-label={`${Math.round((raised / goal) * 100)}% of goal`}
                  />
                ) : null}

                <p className="mt-3 text-sm text-muted-foreground">{f.takeDescription}</p>

                {f.is_public && f.public_slug && (
                  <p className="mt-2 text-sm">
                    <a
                      className="underline underline-offset-4"
                      href={`/f/${f.public_slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Public giving page
                    </a>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Section
        title="Disbursements"
        hint="Two people, always: one asks, a different steward approves, then it can be paid."
        actions={isSteward && funds.data?.length ? <NewDisbursement funds={funds.data} /> : undefined}
      >
        {disbursements.isLoading ? (
          <Loading rows={2} />
        ) : disbursements.isError ? (
          <Failed error={disbursements.error} what="Disbursements are not visible to your role" />
        ) : disbursements.data?.length ? (
          <ul className="paper divide-y">
            {disbursements.data.map((d) => (
              <Row key={d.id} d={d} isSteward={isSteward} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing requested yet.</p>
        )}
      </Section>

      <Guarantee>
        The zero take on bail and mutual aid is a commitment, not a promotion, and there is no
        setting anywhere in Coram that changes it. A group posting bail should not be paying a
        software company for the privilege.
      </Guarantee>
    </>
  );
}

function Row({ d, isSteward }: { d: Disbursement; isSteward: boolean }) {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['disbursements'] });
    void client.invalidateQueries({ queryKey: ['funds'] });
  };

  const approve = useMutation({
    mutationFn: () => post(`/funds/disbursements/${d.id}/approve`),
    onSuccess: () => {
      say('Approved.');
      invalidate();
    },
    onError: (e: Error) => failed('Not approved', e),
  });

  const pay = useMutation({
    mutationFn: () => post(`/funds/disbursements/${d.id}/pay`),
    onSuccess: () => {
      say('Recorded as paid.');
      invalidate();
    },
    onError: (e: Error) => failed('Not recorded', e),
  });

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
      <span className="font-medium tabular-nums">{money(d.amount_cents, d.currency)}</span>
      <span className="text-sm text-muted-foreground">{d.fund_name}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{d.purpose}</span>
      <Badge
        variant={d.status === 'paid' ? 'outline' : 'secondary'}
        className="font-normal"
        title={`Requested ${day(d.created_at)}`}
      >
        {words(d.status)}
      </Badge>
      {isSteward && d.status === 'requested' && (
        <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate()}>
          Approve
        </Button>
      )}
      {isSteward && d.status === 'approved' && (
        <Button size="sm" disabled={pay.isPending} onClick={() => pay.mutate()}>
          Mark paid
        </Button>
      )}
    </li>
  );
}

function NewFund() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('mutual_aid');
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/funds', {
        name: String(form.get('name') ?? '').trim(),
        description: String(form.get('description') ?? '').trim() || undefined,
        kind,
        goalCents: Number(form.get('goal')) ? Math.round(Number(form.get('goal')) * 100) : undefined,
        isPublic: form.get('isPublic') === 'on',
      }),
    onSuccess: () => {
      say('Fund opened.');
      void client.invalidateQueries({ queryKey: ['funds'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not opened', e),
  });

  const free = kind === 'bail' || kind === 'mutual_aid';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PiggyBank className="mr-2 h-4 w-4" />
          Open a fund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a fund</DialogTitle>
          <DialogDescription>What kind it is decides what Coram charges.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="f-name">Name</Label>
            <Input id="f-name" name="name" required placeholder="Eviction defence fund" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="f-kind">Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="f-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-goal">Goal</Label>
              <Input id="f-goal" name="goal" type="number" min={1} placeholder="5000" />
            </div>
          </div>
          <p
            className={cn(
              'rounded-lg px-4 py-3 text-sm leading-relaxed',
              free ? 'bg-teal/[0.08] text-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {free
              ? 'Coram takes nothing from this fund. Not a reduced rate — nothing. Card processing fees still apply; those are Stripe’s, not ours.'
              : 'Coram takes 1% of what this fund raises. Card processing fees are on top and are Stripe’s.'}
          </p>
          <div className="space-y-2">
            <Label htmlFor="f-desc">What it is for</Label>
            <Textarea id="f-desc" name="description" rows={3} />
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" name="isPublic" className="h-4 w-4 accent-flame" />
            Give it a public giving page
          </label>
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

function NewDisbursement({ funds }: { funds: Fund[] }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/funds/disbursements', {
        fundId: String(form.get('fundId')),
        amountCents: Math.round(Number(form.get('amount')) * 100),
        purpose: String(form.get('purpose') ?? '').trim(),
      }),
    onSuccess: () => {
      say('Requested.', 'A different steward has to approve it before it can be paid.');
      void client.invalidateQueries({ queryKey: ['disbursements'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not requested', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Request a payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a payment</DialogTitle>
          <DialogDescription>
            You cannot approve your own request. That is enforced in the database, not here.
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
            <Label htmlFor="d-fund">From</Label>
            <Select name="fundId" defaultValue={funds[0]?.id}>
              <SelectTrigger id="d-fund">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} — {money(f.available_cents, f.currency)} unspent
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-amount">Amount</Label>
            <Input id="d-amount" name="amount" type="number" min={1} step="0.01" required className="w-40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-purpose">What for</Label>
            <Textarea id="d-purpose" name="purpose" rows={3} required placeholder="Bond, case 26-CR-1184" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Do not name the person this is for. A financial record is kept for seven years; the
              jail-support case it relates to is deleted thirty days after it closes, and naming
              someone here would quietly outlive that.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Requesting…' : 'Request it'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
