/**
 * The watch list — bills, hearings and agendas that moved.
 *
 * Rendered as a tab inside Advocacy rather than as its own module, because §5
 * is a closed list of eleven and this is advocacy: the step before lobbying a
 * committee is knowing the committee is meeting.
 *
 * ---------------------------------------------------------------------------
 * Three things this screen has to say out loud
 * ---------------------------------------------------------------------------
 *
 *   1. What put an item here. Every row shows the group's own words that
 *      matched it, because a feed whose selection criteria are invisible is a
 *      feed people stop trusting the first time it surprises them.
 *
 *   2. When a source last worked. A feed that has been failing for three weeks
 *      looks exactly like a quiet one, and a group who believe they are being
 *      told about hearings and are not have been actively misled by us. The
 *      failure is on the screen, in words, with the reason.
 *
 *   3. That the list expires. Ninety days, said plainly, next to the thing that
 *      does not expire — the event or the draft an item became.
 *
 * The AI summary is labelled as one everywhere it appears. It is a convenience
 * for triage and the link to the actual document sits beside it; a summary that
 * reads as though it were the notice is how somebody turns up on the wrong day.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, RefreshCw, Rss, Sparkles, Trash2 } from 'lucide-react';

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
import { Guarantee, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { api, day, del, patch, post } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { ITEM_RETENTION_DAYS, MAX_SOURCES, MAX_TOPICS } from '@shared/watch';

interface TopicRow {
  id: string;
  label: string;
  terms: string[];
  active: boolean;
}

interface SourceRow {
  id: string;
  kind: 'bills' | 'feed';
  label: string;
  jurisdiction: string | null;
  url: string | null;
  active: boolean;
  last_polled_at: string | null;
  last_status: 'ok' | 'failed' | null;
  last_error: string | null;
  last_found: number;
  items: number;
}

interface ItemRow {
  id: string;
  source_label: string;
  title: string;
  url: string;
  published_at: string | null;
  summary: string | null;
  relevance: number | null;
  matched_terms: string[];
  state: 'new' | 'kept' | 'dismissed';
  converted_kind: 'event' | 'bill' | null;
  converted_id: string | null;
  first_seen_at: string;
}

export function Watch({ canEdit }: { canEdit: boolean }) {
  const client = useQueryClient();
  const [shown, setShown] = useState<'new' | 'kept' | 'dismissed'>('new');

  const topics = useQuery({ queryKey: ['watch-topics'], queryFn: () => api<TopicRow[]>('/watch/topics') });
  const sources = useQuery({
    queryKey: ['watch-sources'],
    queryFn: () => api<SourceRow[]>('/watch/sources'),
  });
  const items = useQuery({
    queryKey: ['watch-items', shown],
    queryFn: () => api<ItemRow[]>(`/watch/items?state=${shown}`),
  });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['watch-items'], refetchType: 'all' });
    void client.invalidateQueries({ queryKey: ['watch-sources'], refetchType: 'all' });
  };

  const poll = useMutation({
    mutationFn: () => post<{ polled: number; found: number; failures: { source: string; error: string }[] }>('/watch/poll'),
    onSuccess: (report) => {
      say(
        report.found === 0
          ? `Checked ${report.polled} source${report.polled === 1 ? '' : 's'}. Nothing new matched your words.`
          : `${report.found} new item${report.found === 1 ? '' : 's'} from ${report.polled} source${report.polled === 1 ? '' : 's'}.`,
      );
      refresh();
    },
    onError: (e: Error) => failed('The check did not finish', e),
  });

  const hasTopics = (topics.data ?? []).some((t) => t.active);
  const hasSources = (sources.data ?? []).some((s) => s.active);

  return (
    <div className="space-y-10">
      {/*
        No section heading here, and that is a layout decision the screenshot
        made for me. The tab above already says "What is moving"; repeating it
        as a heading with a paragraph under it read as two stacked headers and
        pushed the first actual item to sixty percent of the way down the page.
        The retention sentence it carried is in the guarantee at the foot, which
        is where every other promise of that kind lives.
      */}
      <div>
        {!hasTopics || !hasSources ? (
          <Empty
            title="Nothing is being watched yet"
            reason={
              !hasTopics && !hasSources
                ? 'Add the words that matter to you — “eviction”, “rent board”, a bill number — and somewhere to look for them. We check every six hours and only tell you about documents that actually contain your words.'
                : !hasTopics
                  ? 'You have somewhere to look but no words to look for. A source with no topics is never polled — we will not fetch somebody’s agenda to throw all of it away.'
                  : 'You have words but nowhere to look for them. Add a state’s bills, or the RSS address of a council agenda page.'
            }
          />
        ) : (
          <>
            <Tabs value={shown} onValueChange={(v) => setShown(v as typeof shown)}>
              {/* One row: what you are looking at, and the button that refills it. */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="kept">Kept</TabsTrigger>
                  <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
                </TabsList>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => poll.mutate()}
                    disabled={poll.isPending}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {poll.isPending ? 'Checking…' : 'Check now'}
                  </Button>
                )}
              </div>

              <TabsContent value={shown}>
                {items.isLoading ? (
                  <Loading rows={3} label="Loading the watch list" />
                ) : items.isError ? (
                  <Failed error={items.error} what="We could not load the watch list" />
                ) : items.data?.length === 0 ? (
                  <Empty
                    title={shown === 'new' ? 'Nothing new' : `Nothing ${shown}`}
                    reason={
                      shown === 'new'
                        ? 'Every source has been checked and nothing published since matched your words. That is the ordinary state of a watch list most weeks.'
                        : 'Items you act on land here.'
                    }
                  />
                ) : (
                  <ul className="space-y-4">
                    {items.data?.map((item) => (
                      <Item key={item.id} item={item} canEdit={canEdit} onChanged={refresh} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Topics topics={topics} canEdit={canEdit} />
      <Sources sources={sources} canEdit={canEdit} />

      <Guarantee>
        This list holds public documents and the words you chose, and nothing else — no record of
        who read what, and nothing about anybody in your group. We fetch the feeds from our servers
        rather than yours, so the council sees us rather than your office. Items are deleted after{' '}
        {ITEM_RETENTION_DAYS} days.
      </Guarantee>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One item
// ---------------------------------------------------------------------------

function Item({
  item,
  canEdit,
  onChanged,
}: {
  item: ItemRow;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const setState = useMutation({
    mutationFn: (state: 'new' | 'kept' | 'dismissed') => patch(`/watch/items/${item.id}`, { state }),
    onSuccess: onChanged,
    onError: (e: Error) => failed('Not saved', e),
  });

  return (
    <li className="paper px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-display text-lg underline decoration-tone/40 underline-offset-4 hover:decoration-tone"
        >
          {item.title}
          <ExternalLink className="ml-1.5 inline h-3.5 w-3.5 align-baseline" />
        </a>
        {item.converted_kind && (
          <Badge variant="secondary">
            {item.converted_kind === 'event' ? 'On the calendar' : 'A draft bill'}
          </Badge>
        )}
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {item.source_label}
        {item.published_at ? ` · ${day(item.published_at)}` : ''}
        {item.relevance !== null ? ` · scored ${item.relevance}` : ''}
      </p>

      {item.summary && (
        <p className="mt-3 flex gap-2 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-tone" aria-hidden />
          <span>
            <span className="sr-only">Machine-written summary. </span>
            {item.summary}
          </span>
        </p>
      )}

      {/*
        Why this row is here at all. A feed whose selection is invisible is one
        people stop trusting the first time it surprises them, and "we matched
        your word" is a complete and checkable answer.
      */}
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>Matched</span>
        {item.matched_terms.map((term) => (
          <Badge key={term} variant="outline" className="border-tone/40 font-normal">
            {term}
          </Badge>
        ))}
      </p>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!item.converted_kind && <Convert item={item} onChanged={onChanged} />}
          {item.state !== 'kept' && (
            <Button variant="outline" size="sm" onClick={() => setState.mutate('kept')}>
              Keep
            </Button>
          )}
          {item.state !== 'dismissed' && (
            <Button variant="ghost" size="sm" onClick={() => setState.mutate('dismissed')}>
              Not for us
            </Button>
          )}
          {item.state === 'dismissed' && (
            <Button variant="ghost" size="sm" onClick={() => setState.mutate('new')}>
              Put it back
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Turning an item into something the group owns.
 *
 * A feed rarely says when a meeting is — only when the notice was posted — so
 * the date is asked for rather than guessed. Guessing would put the wrong
 * evening on somebody's calendar, which is the one failure this feature exists
 * to prevent.
 */
function Convert({ item, onChanged }: { item: ItemRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [as, setAs] = useState<'event' | 'bill'>('event');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const convert = useMutation({
    mutationFn: () =>
      post(
        `/watch/items/${item.id}/convert`,
        as === 'event'
          ? { as, startsAt: new Date(startsAt).toISOString(), location: location || undefined }
          : { as, jurisdiction },
      ),
    onSuccess: () => {
      say(as === 'event' ? 'On the calendar.' : 'Started as a draft.');
      setOpen(false);
      onChanged();
    },
    onError: (e: Error) => setProblem(e.message),
  });

  const ready = as === 'event' ? Boolean(startsAt) : /^[A-Za-z]{2}$/.test(jurisdiction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Turn this into…</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>
            What you make from this keeps the link and does not expire. The watch item itself is
            deleted after {ITEM_RETENTION_DAYS} days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Make it</Label>
            <Select value={as} onValueChange={(v) => setAs(v as 'event' | 'bill')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">An event people can turn up to</SelectItem>
                <SelectItem value="bill">A draft bill of our own</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {as === 'event' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="watch-when">When it actually happens</Label>
                <Input
                  id="watch-when"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The notice says when it was posted, not when the meeting is. Read the document and
                  put the real time in — we will not guess it for you.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="watch-where">Where</Label>
                <Input
                  id="watch-where"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City Hall, chamber B"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="watch-juris">Jurisdiction</Label>
              <Input
                id="watch-juris"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="CA"
                maxLength={2}
              />
            </div>
          )}

          {problem && <p className="text-sm text-flame">{problem}</p>}
        </div>

        <DialogFooter>
          <Button onClick={() => convert.mutate()} disabled={!ready || convert.isPending}>
            {convert.isPending ? 'Making it…' : 'Make it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

function Topics({
  topics,
  canEdit,
}: {
  topics: ReturnType<typeof useQuery<TopicRow[]>>;
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const refresh = () =>
    void client.invalidateQueries({ queryKey: ['watch-topics'], refetchType: 'all' });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/watch/topics/${id}`),
    onSuccess: refresh,
    onError: (e: Error) => failed('Not removed', e),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      patch(`/watch/topics/${id}`, { active }),
    onSuccess: refresh,
    onError: (e: Error) => failed('Not changed', e),
  });

  return (
    <Section
      title="What you are watching for"
      hint="Your words, matched against the whole of every document — not just its title. A word has to appear as a word: “rent” will not match “current”."
      actions={canEdit && <NewTopic count={topics.data?.length ?? 0} onDone={refresh} />}
    >
      {topics.isLoading ? (
        <Loading rows={2} label="Loading topics" />
      ) : topics.isError ? (
        <Failed error={topics.error} what="We could not load your topics" />
      ) : topics.data?.length === 0 ? (
        <Empty
          title="No topics yet"
          reason="Start with two or three. A topic that is too broad fills the list and a list that is always full is one nobody reads."
        />
      ) : (
        <ul className="space-y-3">
          {topics.data?.map((topic) => (
            <li key={topic.id} className="paper flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className="font-medium">{topic.label}</span>
              <span className="flex flex-wrap gap-1.5">
                {topic.terms.map((term) => (
                  <Badge key={term} variant="outline" className="border-tone/40 font-normal">
                    {term}
                  </Badge>
                ))}
              </span>
              {!topic.active && <Badge variant="secondary">paused</Badge>}
              {canEdit && (
                <span className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggle.mutate({ id: topic.id, active: !topic.active })}
                  >
                    {topic.active ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${topic.label}`}
                    onClick={() => remove.mutate(topic.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function NewTopic({ count, onDone }: { count: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [terms, setTerms] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      post('/watch/topics', {
        label,
        terms: terms.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      say('Watching for that.');
      setOpen(false);
      setLabel('');
      setTerms('');
      setProblem(null);
      onDone();
    },
    onError: (e: Error) => setProblem(e.message),
  });

  if (count >= MAX_TOPICS) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add a topic
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a topic</DialogTitle>
          <DialogDescription>
            The words themselves, not a description of them. Three letters minimum — anything
            shorter matches half of every agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic-label">What you call it</Label>
            <Input
              id="topic-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Evictions"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-terms">Words to watch for</Label>
            <Input
              id="topic-terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="eviction, unlawful detainer, rent board, SB 442"
            />
            <p className="text-xs text-muted-foreground">
              Separated by commas. A bill number works exactly as typed.
            </p>
          </div>
          {problem && <p className="text-sm text-flame">{problem}</p>}
        </div>

        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!label.trim() || !terms.trim() || create.isPending}>
            {create.isPending ? 'Saving…' : 'Watch for these'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function Sources({
  sources,
  canEdit,
}: {
  sources: ReturnType<typeof useQuery<SourceRow[]>>;
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const refresh = () =>
    void client.invalidateQueries({ queryKey: ['watch-sources'], refetchType: 'all' });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/watch/sources/${id}`),
    onSuccess: refresh,
    onError: (e: Error) => failed('Not removed', e),
  });

  return (
    <Section
      title="Where we look"
      hint="A state’s bills, or the RSS address of any page that publishes one — a council agenda, a court calendar, a local paper’s city desk."
      actions={canEdit && <NewSource count={sources.data?.length ?? 0} onDone={refresh} />}
    >
      {sources.isLoading ? (
        <Loading rows={2} label="Loading sources" />
      ) : sources.isError ? (
        <Failed error={sources.error} what="We could not load your sources" />
      ) : sources.data?.length === 0 ? (
        <Empty
          title="No sources yet"
          reason="Most cities publish agendas as RSS even when they do not advertise it — look for a small orange icon, or try adding /rss or .xml to the agendas page."
        />
      ) : (
        <ul className="space-y-3">
          {sources.data?.map((source) => (
            <li key={source.id} className="paper px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Rss className="h-4 w-4 shrink-0 text-tone" aria-hidden />
                <span className="font-medium">{source.label}</span>
                <Badge variant="outline" className="font-normal">
                  {source.kind === 'bills' ? `${source.jurisdiction} bills` : 'feed'}
                </Badge>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    aria-label={`Remove ${source.label}`}
                    onClick={() => remove.mutate(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/*
                A failing source is stated in words with its reason, not left to
                be inferred from an absence. See the file header.
              */}
              {source.last_status === 'failed' ? (
                <p className="mt-2 text-sm text-flame">
                  Last check failed{source.last_polled_at ? ` on ${day(source.last_polled_at)}` : ''}
                  : {source.last_error}
                </p>
              ) : source.last_polled_at ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Checked {day(source.last_polled_at)} · {source.last_found} new that time ·{' '}
                  {source.items} on the list
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Not checked yet. The scheduled check runs every six hours.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function NewSource({ count, onDone }: { count: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'feed' | 'bills'>('feed');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      post('/watch/sources', kind === 'feed' ? { kind, label, url } : { kind, label, jurisdiction }),
    onSuccess: () => {
      say('Added. The next check will read it.');
      setOpen(false);
      setLabel('');
      setUrl('');
      setJurisdiction('');
      setProblem(null);
      onDone();
    },
    onError: (e: Error) => setProblem(e.message),
  });

  if (count >= MAX_SOURCES) return null;

  const ready =
    label.trim() && (kind === 'feed' ? url.trim() : /^[A-Za-z]{2}$/.test(jurisdiction));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add a source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
          <DialogDescription>
            We fetch it from our servers, every six hours. The site sees us rather than your office.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as 'feed' | 'bills')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feed">An RSS or Atom feed</SelectItem>
                <SelectItem value="bills">Bills in one state</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-label">What you call it</Label>
            <Input
              id="source-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind === 'feed' ? 'City council agendas' : 'California bills'}
            />
          </div>

          {kind === 'feed' ? (
            <div className="space-y-2">
              <Label htmlFor="source-url">Address</Label>
              <Input
                id="source-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.gov/agendas/rss"
              />
              <p className="text-xs text-muted-foreground">
                https only. We will not fetch over plain http, because anyone on the path could
                change what we read.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="source-juris">State</Label>
              <Input
                id="source-juris"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="CA"
                maxLength={2}
              />
            </div>
          )}

          {problem && <p className="text-sm text-flame">{problem}</p>}
        </div>

        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!ready || create.isPending}>
            {create.isPending ? 'Adding…' : 'Add it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
