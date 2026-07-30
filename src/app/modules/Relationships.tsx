/**
 * Vinculum (§5.2) — the queue an organizer actually lives in.
 *
 * Competitors sell this as a separate product. Here it shares the contact
 * record, which is the only reason a one-to-one can close a follow-up and open
 * the next one in a single transaction rather than leaving the queue claiming a
 * conversation is still owed after it happened.
 *
 * The snooze count is shown, never hidden. It is the one signal that tells "not
 * yet" from "never", and a queue of thrice-snoozed items is not a queue — it is
 * a list of things nobody is going to do. Better to see that than to keep
 * pushing them a week at a time.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Figure, Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { apiWithNotice, fromNow, post, postWithNotice } from '@/lib/api';
import { failed, say, sayResult } from '@/lib/notify';
import { MODULES } from '@/lib/modules';
import { cn } from '@/lib/utils';

const MODULE = MODULES.find((m) => m.path === '/relationships')!;

interface QueueRow {
  id: string;
  reason: string;
  contact_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  due_at: string;
  snoozed_until: string | null;
  snooze_count: number;
  escalated_at: string | null;
  effective_due_at: string;
  overdue: boolean;
}

interface Config {
  outcomeCodes: { id: string; code: string; label: string; is_positive: boolean }[];
  ladders: { id: string; name: string; rungs: { id: string; name: string; position: number }[] }[];
}

export function Relationships() {
  const client = useQueryClient();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [logging, setLogging] = useState<QueueRow | null>(null);

  const queue = useQuery({
    queryKey: ['queue', scope],
    queryFn: () =>
      apiWithNotice<QueueRow[], { overdue?: number; repeatedlySnoozed?: number }>(
        `/vinculum/queue?mine=${scope === 'mine'}`,
      ),
  });
  const config = useQuery({ queryKey: ['vinculum-config'], queryFn: () => apiWithNotice<Config>('/vinculum/config') });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['queue'] });
    void client.invalidateQueries({ queryKey: ['contacts'] });
  };

  const snooze = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      postWithNotice(`/vinculum/follow-ups/${id}/snooze`, {
        until: new Date(Date.now() + days * 86_400_000).toISOString(),
      }),
    onSuccess: (r) => {
      sayResult('Snoozed.', r.notice);
      invalidate();
    },
    onError: (e: Error) => failed('Could not snooze that', e),
  });

  const escalate = useMutation({
    mutationFn: (id: string) => postWithNotice(`/vinculum/follow-ups/${id}/escalate`),
    onSuccess: (r) => {
      sayResult('Escalated.', r.notice);
      invalidate();
    },
    onError: (e: Error) => failed('Could not escalate', e),
  });

  const close = useMutation({
    mutationFn: ({ id, dropped }: { id: string; dropped: boolean }) =>
      post(`/vinculum/follow-ups/${id}/close`, { dropped }),
    onSuccess: (_d, v) => {
      say(v.dropped ? 'Dropped.' : 'Marked done.');
      invalidate();
    },
    onError: (e: Error) => failed('Could not close that', e),
  });

  const rows = queue.data?.data ?? [];
  const overdue = rows.filter((r) => r.overdue).length;
  const stuck = rows.filter((r) => Number(r.snooze_count) >= 3).length;

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Relationships"
        description="Conversations you said you would have, and what came of the ones you did."
        actions={
          <Tabs value={scope} onValueChange={(v) => setScope(v as 'mine' | 'all')}>
            <TabsList>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              <TabsTrigger value="all">Everyone’s</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Figure value={rows.length} label="Open follow-ups" />
        <Figure value={overdue} label="Already late" note={overdue ? 'Oldest first, below' : 'Nothing overdue'} />
        <Figure
          value={stuck}
          label="Snoozed 3+ times"
          note={stuck ? 'Worth dropping or handing on' : 'None stuck'}
        />
      </div>

      <Section title="The queue">
        {queue.isLoading ? (
          <Loading rows={4} label="Loading the queue" />
        ) : queue.isError ? (
          <Failed error={queue.error} what="We could not load the queue" />
        ) : rows.length === 0 ? (
          <Empty
            title={scope === 'mine' ? 'Nothing owed by you' : 'Nothing owed by anyone'}
            reason="A follow-up appears here when someone logs a conversation with a next step, or when you add one by hand from a person's record."
          />
        ) : (
          <ul className="paper divide-y">
            {rows.map((f) => (
              <li key={f.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{f.display_name}</span>
                  <span
                    className={cn(
                      'text-sm tabular-nums',
                      f.overdue ? 'font-medium text-flame' : 'text-muted-foreground',
                    )}
                  >
                    {f.overdue ? 'due ' : ''}
                    {fromNow(f.effective_due_at)}
                  </span>
                  {Number(f.snooze_count) > 0 && (
                    <Badge variant="secondary" className="font-normal">
                      snoozed {f.snooze_count}×
                    </Badge>
                  )}
                  {f.escalated_at && (
                    <Badge variant="outline" className="border-deep/40 font-normal text-deep">
                      escalated
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{f.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setLogging(f)}>
                    Log the conversation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={snooze.isPending}
                    onClick={() => snooze.mutate({ id: f.id, days: 7 })}
                  >
                    Snooze a week
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={escalate.isPending}
                    onClick={() => escalate.mutate(f.id)}
                  >
                    Escalate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={close.isPending}
                    onClick={() => close.mutate({ id: f.id, dropped: true })}
                  >
                    Drop it
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Guarantee>
        Escalating shows an organizer’s lead that something is overdue. It does not move the
        follow-up off you, and it does not give the lead access to the contact — turf bounds are not
        something a button can widen.
      </Guarantee>

      <LogConversation
        row={logging}
        config={config.data?.data}
        onClose={() => setLogging(null)}
        onDone={invalidate}
      />
    </>
  );
}

/**
 * One call, one transaction: log what happened, move the ladder, close the
 * follow-up that prompted it, open the next one. Doing these as four requests
 * is how a queue ends up showing a conversation as still owed after it happened.
 */
function LogConversation({
  row,
  config,
  onClose,
  onDone,
}: {
  row: QueueRow | null;
  config: Config | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const rungs = config?.ladders.flatMap((l) => l.rungs.map((r) => ({ ...r, ladder: l.name }))) ?? [];

  const log = useMutation({
    mutationFn: (form: FormData) => {
      const nextDays = Number(form.get('nextDays') ?? 0);
      const outcome = String(form.get('outcomeCodeId') ?? '');
      const rung = String(form.get('movedToRungId') ?? '');
      return post('/vinculum/one-to-ones', {
        contactId: row!.contact_id,
        outcomeCodeId: outcome && outcome !== 'none' ? outcome : undefined,
        movedToRungId: rung && rung !== 'none' ? rung : undefined,
        nextStep: String(form.get('nextStep') ?? '').trim() || undefined,
        closesFollowUpId: row!.id,
        ...(nextDays > 0
          ? {
              nextFollowUpAt: new Date(Date.now() + nextDays * 86_400_000).toISOString(),
              nextFollowUpReason: String(form.get('nextReason') ?? '').trim() || 'Follow up',
            }
          : {}),
      });
    },
    onSuccess: () => {
      say('Logged.');
      onDone();
      onClose();
    },
    onError: (e: Error) => failed('Not logged', e),
  });

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conversation with {row?.display_name}</DialogTitle>
          <DialogDescription>
            What was agreed — about the work, not about the person. This is a record an organizer
            keeps, not a dossier.
          </DialogDescription>
        </DialogHeader>
        {row && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              log.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="outcome">How it went</Label>
              <Select name="outcomeCodeId" defaultValue="none">
                <SelectTrigger id="outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not recorded</SelectItem>
                  {config?.outcomeCodes.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rungs.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="rung">Moved to</Label>
                <Select name="movedToRungId" defaultValue="none">
                  <SelectTrigger id="rung">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No change</SelectItem>
                    {rungs.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.ladder}: {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nextStep">What was agreed</Label>
              <Textarea id="nextStep" name="nextStep" rows={3} placeholder="Bringing two neighbours to the rent board hearing." />
            </div>

            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="nextDays">Check back in</Label>
                <Input id="nextDays" name="nextDays" type="number" min={0} defaultValue={14} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextReason">About what</Label>
                <Input id="nextReason" name="nextReason" defaultValue="See how it went" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Days from today. Zero closes this follow-up without opening another.
            </p>

            <DialogFooter>
              <Button type="submit" disabled={log.isPending}>
                {log.isPending ? 'Saving…' : 'Log it'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
