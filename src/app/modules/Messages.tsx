/**
 * Colloquium (§5.7) — channels that forget on a schedule.
 *
 * Everything typed here is sealed in this browser before it is sent. The server
 * gets an envelope — which room, who spoke, roughly how long, when — and a
 * blob it cannot read, which it deletes when the channel's TTL runs out.
 *
 * The passphrase prompt is not a rough edge to be smoothed away later. There is
 * no key escrow and no "reset my channel key", because either would mean
 * holding a key, which is the thing we are declining to do. A group agreeing a
 * phrase out loud in a room is the honest version of key exchange at this size,
 * and the screen says so instead of implying magic.
 *
 * Note the absence: a steward can see this channel exists and can delete it.
 * They cannot read it and cannot join it silently. There is no policy in 0008
 * that would let them, and none should be added "just in case" — that is how it
 * ends up being used.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, KeyRound, Lock, Send } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { Guarantee, PageHeader } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { apiWithNotice, post, when } from '@/lib/api';
import { channelKey, open as unseal, seal, SealError } from '@/lib/channelKey';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';
import { cn } from '@/lib/utils';

const MODULE = MODULES.find((m) => m.path === '/messages')!;

interface Channel {
  id: string;
  name: string | null;
  kind: string;
  ttl_days: number;
  joined: boolean;
  members: number;
  last_message_at: string | null;
}

interface Sealed {
  id: string;
  ciphertext: string;
  nonce: string;
  senderId: string;
  sentAt: number;
}

export function Messages() {
  const client = useQueryClient();
  const [active, setActive] = useState<Channel | null>(null);

  const channels = useQuery({
    queryKey: ['channels'],
    queryFn: () => apiWithNotice<Channel[], { retention?: string }>('/colloquium/channels'),
  });

  const join = useMutation({
    mutationFn: (id: string) => post(`/colloquium/channels/${id}/join`),
    onSuccess: () => {
      say('You are in.');
      void client.invalidateQueries({ queryKey: ['channels'] });
    },
    onError: (e: Error) => failed('Could not join', e),
  });

  const rows = channels.data?.data ?? [];

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Messages"
        description="Sealed in your browser, delivered by us, forgotten on a schedule. We keep envelopes — who spoke where and when — and never the words."
        actions={<NewChannel />}
      />

      {channels.isLoading ? (
        <Loading rows={3} label="Loading channels" />
      ) : channels.isError ? (
        <Failed error={channels.error} what="We could not load your channels" />
      ) : rows.length === 0 ? (
        <Empty
          title="No channels"
          reason="Open one for the thing you are organizing. Messages in it are deleted after the channel's TTL — thirty days at most, and that ceiling is a database constraint, not a setting."
          action={<NewChannel />}
        />
      ) : (
        <ul className="mb-8 space-y-2">
          {rows.map((ch) => (
            <li key={ch.id} className="paper flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              <Hash aria-hidden className="h-4 w-4 shrink-0 text-plum" />
              <span className="font-medium">{ch.name ?? 'Direct message'}</span>
              <Badge variant="secondary" className="font-normal">
                forgets after {ch.ttl_days} days
              </Badge>
              <span className="text-sm text-muted-foreground">
                {ch.members} member{ch.members === 1 ? '' : 's'}
                {ch.last_message_at ? ` · last spoken ${when(ch.last_message_at)}` : ' · quiet'}
              </span>
              {ch.joined ? (
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => setActive(ch)}>
                  Open
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={join.isPending}
                  onClick={() => join.mutate(ch.id)}
                >
                  Join
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {channels.data?.meta.retention && (
        <Guarantee>{channels.data.meta.retention}</Guarantee>
      )}

      <Room channel={active} onClose={() => setActive(null)} />
    </>
  );
}

function Room({ channel, onClose }: { channel: Channel | null; onClose: () => void }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [plain, setPlain] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  // The key belongs to a room. Changing rooms drops it rather than carrying it
  // across, which would silently seal one channel's messages with another's.
  useEffect(() => {
    setKey(null);
    setPassphrase('');
    setPlain({});
  }, [channel?.id]);

  const messages = useQuery({
    queryKey: ['messages', channel?.id],
    queryFn: () => apiWithNotice<{ messages: Sealed[]; cursor: number }>(
      `/colloquium/channels/${channel!.id}/messages`,
    ),
    enabled: Boolean(channel),
    refetchInterval: channel ? 8_000 : false,
  });

  const sealed = messages.data?.data.messages ?? [];

  // Open whatever we can, whenever either the key or the message list changes.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void (async () => {
      const opened: Record<string, string> = {};
      for (const m of sealed) {
        try {
          opened[m.id] = await unseal(key, m.ciphertext, m.nonce);
        } catch (e) {
          opened[m.id] = e instanceof SealError ? e.message : 'Could not open this.';
        }
      }
      if (!cancelled) setPlain(opened);
    })();
    return () => {
      cancelled = true;
    };
    // `sealed` is intentionally not a dependency: it is a fresh array on every
    // poll, so depending on it would re-derive every message every eight
    // seconds. The count is the signal that something new arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sealed.length, channel?.id]);

  const opened = Object.keys(plain).length;
  useEffect(() => {
    bottom.current?.scrollIntoView();
  }, [opened]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const body = await seal(key!, text);
      return post(`/colloquium/channels/${channel!.id}/messages`, body);
    },
    onSuccess: () => {
      setDraft('');
      void messages.refetch();
    },
    onError: (e: Error) => failed('Not sent', e),
  });

  return (
    <Dialog open={Boolean(channel)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Hash aria-hidden className="h-5 w-5 text-plum" />
            {channel?.name}
          </DialogTitle>
          <DialogDescription>
            Everything here is deleted {channel?.ttl_days} days after it is sent. That is not a
            setting we can be talked out of — it is a constraint on the table.
          </DialogDescription>
        </DialogHeader>

        {!key ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setKey(await channelKey(passphrase, channel!.id));
            }}
          >
            <div className="flex gap-3 rounded-lg border border-plum/25 bg-plum/[0.06] px-5 py-4">
              <KeyRound aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-plum" />
              <p className="text-sm leading-relaxed">
                This channel’s passphrase is agreed by the people in it — said out loud in a room,
                not typed into Coram. We do not have it, cannot reset it, and cannot read a word of
                this channel without it. That is the trade: lose the phrase and the messages are
                gone.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passphrase">Channel passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                autoComplete="off"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!passphrase}>
                <Lock className="mr-2 h-4 w-4" />
                Unlock the room
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {messages.isLoading && <Loading rows={3} />}
              {sealed.length === 0 && !messages.isLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing said here yet, or everything said here has already expired.
                </p>
              )}
              {sealed.map((m) => (
                <div key={m.id} className="rounded-lg border px-4 py-2.5">
                  <p
                    className={cn(
                      'whitespace-pre-wrap text-[0.95rem] leading-relaxed',
                      plain[m.id]?.startsWith('This was sealed') && 'italic text-muted-foreground',
                    )}
                  >
                    {plain[m.id] ?? '…'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(m.sentAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
              <div ref={bottom} />
            </div>

            <form
              className="flex items-end gap-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) send.mutate(draft.trim());
              }}
            >
              <Label htmlFor="draft" className="sr-only">
                Message
              </Label>
              <Textarea
                id="draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Sealed before it leaves this tab"
                className="min-h-0 flex-1"
              />
              <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewChannel() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (form: FormData) =>
      post('/colloquium/channels', {
        name: String(form.get('name') ?? '').trim(),
        ttlDays: Number(form.get('ttlDays') ?? 30),
      }),
    onSuccess: () => {
      say('Channel open.');
      void client.invalidateQueries({ queryKey: ['channels'] });
      setOpen(false);
    },
    onError: (e: Error) => failed('Not opened', e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Open a channel</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a channel</DialogTitle>
          <DialogDescription>
            Thirty days is the ceiling and the default. You can make it shorter; you cannot make it
            longer.
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
            <Label htmlFor="ch-name">Name</Label>
            <Input id="ch-name" name="name" required placeholder="hearing-prep" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ttlDays">Forget messages after</Label>
            <Input
              id="ttlDays"
              name="ttlDays"
              type="number"
              min={1}
              max={30}
              defaultValue={30}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">Days. One to thirty.</p>
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
