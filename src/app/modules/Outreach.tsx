/**
 * Nuntius (§5.4) — email, texting, and the dialer.
 *
 * The load-bearing sentence in §5.4 is about the opt-out ledger: one
 * unsubscribe stops everything, forever, tenant-wide, with no "transactional"
 * loophole. So this screen shows the held-back count on every audience, before
 * the send button, as a number and never as a list. An opt-out that can be
 * turned back into a segment is not an opt-out.
 *
 * The dialer and peer-to-peer threading run on DialerQueueDO and are not yet
 * reachable from here; the panel below says so in plain words rather than
 * showing a button that does nothing.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageSquare, Send } from 'lucide-react';

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
import { api, day, post, words, type Workspace } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';

const MODULE = MODULES.find((m) => m.path === '/outreach')!;

interface Campaign {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  recipients: number;
}

interface Audience {
  matched: number;
  optedOut: number;
  willReceive: number;
  unreachable: number;
}

interface Deliverability {
  total: number;
  byStatus: Record<string, number>;
  bounceRate: number;
  complaintRate: number;
}

export function Outreach() {
  const [open, setOpen] = useState<Campaign | null>(null);
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const list = useQuery({ queryKey: ['campaigns'], queryFn: () => api<Campaign[]>('/campaigns') });
  const canSend = ['steward', 'organizer'].includes(workspace.data?.me.role ?? '');

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Outreach"
        description="Email and texts to the people who said you could. One unsubscribe stops all of it, everywhere, forever."
        actions={canSend && <NewCampaign />}
      />

      {list.isLoading ? (
        <Loading rows={3} label="Loading campaigns" />
      ) : list.isError ? (
        <Failed error={list.error} what="We could not load your campaigns" />
      ) : list.data?.length === 0 ? (
        <Empty
          title="Nothing sent yet"
          reason="Write something, see exactly how many people it reaches and how many are held back by the opt-out ledger, and then decide."
          action={canSend ? <NewCampaign /> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {list.data?.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpen(c)}
                className="paper flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left hover:border-tone/50"
              >
                {c.channel === 'email' ? (
                  <Mail aria-hidden className="h-4 w-4 shrink-0 text-teal" />
                ) : (
                  <MessageSquare aria-hidden className="h-4 w-4 shrink-0 text-teal" />
                )}
                <span className="min-w-0">
                  <span className="block font-display text-lg">{c.name}</span>
                  {c.subject && (
                    <span className="block text-sm text-muted-foreground">{c.subject}</span>
                  )}
                </span>
                <Badge variant={c.status === 'draft' ? 'secondary' : 'outline'} className="ml-auto font-normal">
                  {words(c.status)}
                </Badge>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {c.sent_at ? `${c.recipients} sent · ${day(c.sent_at)}` : 'not sent'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Section title="Peer-to-peer and the dialer" className="mt-10">
        <div className="paper px-5 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Conversation threading and the branching-script dialer run on a Durable Object that is
            built and deployed but not yet reachable from this screen. Rather than show you a button
            that opens an empty panel, this says so. Broadcast email and SMS above are live.
          </p>
        </div>
      </Section>

      <Guarantee>
        Every send goes through the opt-out ledger, including the ones a marketing tool would call
        transactional. There is no setting that switches this off, because a setting that can be
        switched off is not a promise.
      </Guarantee>

      <CampaignPanel campaign={open} canSend={canSend} onClose={() => setOpen(null)} />
    </>
  );
}

function CampaignPanel({
  campaign,
  canSend,
  onClose,
}: {
  campaign: Campaign | null;
  canSend: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const id = campaign?.id;

  const audience = useQuery({
    queryKey: ['audience', id],
    queryFn: () => api<Audience>(`/campaigns/${id}/audience`),
    enabled: Boolean(id) && campaign?.status === 'draft',
  });
  const stats = useQuery({
    queryKey: ['deliverability', id],
    queryFn: () => api<Deliverability>(`/campaigns/${id}/deliverability`),
    enabled: Boolean(id) && campaign?.status !== 'draft',
  });

  const send = useMutation({
    mutationFn: () => post<{ queued: number }>(`/campaigns/${id}/send`),
    onSuccess: (r) => {
      say(`${r.queued} queued.`, 'Delivery happens on the queue; the dashboard updates as it goes.');
      void client.invalidateQueries({ queryKey: ['campaigns'] });
      onClose();
    },
    onError: (e: Error) => failed('Not sent', e),
  });

  return (
    <Dialog open={Boolean(campaign)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {campaign && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{campaign.name}</DialogTitle>
              <DialogDescription>
                {campaign.channel === 'email' ? 'Email' : 'Text message'} ·{' '}
                {words(campaign.status)}
              </DialogDescription>
            </DialogHeader>

            {campaign.status === 'draft' ? (
              <>
                {audience.isLoading && <Loading rows={2} />}
                {audience.data && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Figure value={audience.data.willReceive} label="Will receive" />
                      <Figure value={audience.data.optedOut} label="Opted out" />
                      <Figure value={audience.data.unreachable} label="No address" />
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {audience.data.optedOut} people match this audience and have opted out. They
                      are counted here and nowhere else — Coram will not show you who they are, and
                      there is no export that will.
                    </p>
                  </>
                )}
                {canSend && (
                  <DialogFooter>
                    <Button
                      disabled={send.isPending || !audience.data?.willReceive}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Send to ${audience.data?.willReceive} people? This cannot be recalled.`,
                          )
                        ) {
                          send.mutate();
                        }
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send to {audience.data?.willReceive ?? 0}
                    </Button>
                  </DialogFooter>
                )}
              </>
            ) : (
              <>
                {stats.isLoading && <Loading rows={2} />}
                {stats.data && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Figure value={stats.data.total} label="Sent" />
                      <Figure
                        value={`${(stats.data.bounceRate * 100).toFixed(1)}%`}
                        label="Bounced"
                        note={stats.data.bounceRate > 0.02 ? 'Above the 2% mark' : 'Healthy'}
                      />
                      <Figure
                        value={`${(stats.data.complaintRate * 100).toFixed(2)}%`}
                        label="Complaints"
                        note={stats.data.complaintRate > 0.001 ? 'Above 0.1%' : 'Healthy'}
                      />
                    </div>
                    <ul className="space-y-1 text-sm">
                      {Object.entries(stats.data.byStatus).map(([status, n]) => (
                        <li key={status} className="flex justify-between">
                          <span className="text-muted-foreground">{words(status)}</span>
                          <span className="tabular-nums">{n}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewCampaign() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/campaigns', {
        name: String(form.get('name') ?? '').trim(),
        channel: String(form.get('channel') ?? 'email'),
        subject: String(form.get('subject') ?? '').trim() || undefined,
        body: String(form.get('body') ?? '').trim(),
      }),
    onSuccess: () => {
      say('Saved as a draft.', 'Open it to see the audience before anything goes out.');
      void client.invalidateQueries({ queryKey: ['campaigns'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not saved', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="mr-2 h-4 w-4" />
          Write something
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Saved as a draft. Nothing is sent until you have seen who it reaches.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-2">
              <Label htmlFor="name">Call it</Label>
              <Input id="name" name="name" required placeholder="Hearing turnout push" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Channel</Label>
              <Select name="channel" defaultValue="email">
                <SelectTrigger id="channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" placeholder="Tuesday, 6pm, City Hall" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" rows={7} required />
            <p className="text-xs text-muted-foreground">
              Merge fields: <code>{'{{name}}'}</code>. An unsubscribe link is added to every email
              automatically and cannot be removed.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
