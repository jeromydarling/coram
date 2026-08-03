/**
 * Running the meeting.
 *
 * An agenda with a time against each item, a clock that shows whether you are
 * over it, a note per item, and a speaking stack.
 *
 * ---------------------------------------------------------------------------
 * The stack never leaves this browser
 * ---------------------------------------------------------------------------
 *
 * It is plain React state. There is no route that accepts it, no table that
 * holds it, and closing the tab is the deletion — which the screen says out
 * loud, because a promise nobody is told about is not a feature.
 *
 * The reason is in migration 0019 and worth repeating at the place somebody
 * would come to add persistence: a stored stack is a record of who was in a
 * room on a particular evening and how much each of them said. For a tenants'
 * union meeting about a landlord, an immigration clinic, or a strike committee,
 * that is the most damaging document the group could produce about itself, and
 * unlike a contact list it has no operational value the morning after.
 *
 * A stack that survives a browser crash would be a real convenience. It is not
 * worth what it costs, and the convenience is exactly the argument somebody
 * will make for building it.
 *
 * ---------------------------------------------------------------------------
 * The clock nags, it does not enforce
 * ---------------------------------------------------------------------------
 *
 * Over-time turns red and keeps counting. Nothing advances by itself and
 * nothing is cut off. A facilitator with a room in front of them knows
 * something the timer does not, and software that ends an item because a number
 * ran out is software that has misunderstood what a meeting is.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock, Plus, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Guarantee, Section } from '@/components/coram/Page';
import { Empty, Failed, Loading } from '@/components/coram/State';
import { api, day, patch, post } from '@/lib/api';
import { failed, say } from '@/lib/notify';

interface Item {
  title: string;
  minutes: number;
  note?: string;
}

interface Agenda {
  id: string;
  title: string;
  met_on: string;
  items: Item[];
  started_at: string | null;
  finished_at: string | null;
}

export function Facilitate() {
  const [params, setParams] = useSearchParams();
  const openId = params.get('agenda');

  const agendas = useQuery({
    queryKey: ['agendas'],
    queryFn: () => api<Agenda[]>('/organizing/agendas'),
  });

  if (openId) {
    const agenda = agendas.data?.find((a) => a.id === openId);
    if (agendas.isLoading) return <Loading rows={5} label="Loading the agenda" />;
    if (agenda) return <Run agenda={agenda} onBack={() => setParams({})} />;
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Run a meeting</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            An agenda with a time against each item, a clock that tells you when you are over it,
            and a stack that never leaves this browser.
          </p>
        </div>
        <NewAgenda onDone={() => agendas.refetch()} />
      </div>

      <div className="tone-rule mt-6 h-px w-full" />

      <div className="mt-8">
        {agendas.isLoading ? (
          <Loading rows={3} label="Loading agendas" />
        ) : agendas.isError ? (
          <Failed error={agendas.error} what="We could not load your agendas" />
        ) : agendas.data?.length === 0 ? (
          <Empty
            title="No agendas yet"
            reason="Write the items and put a number of minutes against each one. The numbers are the useful part — an agenda without them is a list of things that will not all get discussed."
          />
        ) : (
          <ul className="space-y-3">
            {agendas.data?.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setParams({ agenda: a.id })}
                  className="paper block w-full px-5 py-4 text-left hover:border-tone/50"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-xl">{a.title}</span>
                    {a.finished_at ? (
                      <Badge variant="secondary">finished</Badge>
                    ) : a.started_at ? (
                      <Badge>in progress</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {day(a.met_on)} · {a.items.length} {a.items.length === 1 ? 'item' : 'items'} ·{' '}
                    {a.items.reduce((n, i) => n + i.minutes, 0)} minutes planned
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function NewAgenda({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [open, setOpen] = useState(false);

  /*
   * One textarea rather than a repeating row editor.
   *
   * An agenda is written in two minutes before a meeting, usually pasted from
   * a message somebody already sent. "Item — 10" per line is faster than eight
   * clicks and it is how people already write them.
   */
  const parse = (): Item[] =>
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 60)
      .map((line) => {
        const m = /^(.*?)[\s—–-]+(\d{1,3})\s*(?:min|minutes|m)?$/i.exec(line);
        return m
          ? { title: m[1].trim().slice(0, 200), minutes: Number(m[2]) }
          : { title: line.slice(0, 200), minutes: 10 };
      });

  const create = useMutation({
    mutationFn: () => post('/organizing/agendas', { title, items: parse() }),
    onSuccess: () => {
      say('Agenda saved.');
      setTitle('');
      setRaw('');
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => failed('Not saved', e),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New agenda
      </Button>
    );
  }

  return (
    <div className="paper w-full max-w-xl space-y-4 px-5 py-4">
      <div className="space-y-2">
        <Label htmlFor="ag-title">What meeting</Label>
        <Input
          id="ag-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Monthly general meeting"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ag-items">The items</Label>
        <Textarea
          id="ag-items"
          rows={7}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'Welcome and introductions — 5\nRepairs campaign report — 15\nVote on the ordinance — 20\nFood'}
        />
        <p className="text-xs text-muted-foreground">
          One per line. A number at the end is the minutes; anything without one gets ten.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
          {create.isPending ? 'Saving…' : 'Save it'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Running one
// ---------------------------------------------------------------------------

function Run({ agenda, onBack }: { agenda: Agenda; onBack: () => void }) {
  const client = useQueryClient();
  const [current, setCurrent] = useState(0);
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(agenda.items.map((item, i) => [i, item.note ?? ''])),
  );

  /* Seconds on the current item. Reset when the item changes, not when the
     component re-renders — a note being typed must not restart the clock. */
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1_000);
    return () => clearInterval(timer);
  }, [current]);

  const save = useMutation({
    mutationFn: (extra: Record<string, unknown> = {}) =>
      patch(`/organizing/agendas/${agenda.id}`, {
        items: agenda.items.map((item, i) => ({ ...item, note: notes[i] || undefined })),
        started: true,
        ...extra,
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['agendas'], refetchType: 'all' }),
    onError: (e: Error) => failed('Not saved', e),
  });

  const writeUp = useMutation({
    mutationFn: async () => {
      await save.mutateAsync({ finished: true });
      return post(`/organizing/agendas/${agenda.id}/minutes`);
    },
    onSuccess: () => say('Written up as a draft in Governance. Somebody still has to adopt it.'),
    onError: (e: Error) => failed('Not written up', e),
  });

  const item = agenda.items[current];
  const allotted = (item?.minutes ?? 0) * 60;
  const over = allotted > 0 && elapsed > allotted;
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All agendas
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">{agenda.title}</h1>
          <p className="mt-1 text-muted-foreground">{day(agenda.met_on)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save.mutate({})} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save notes'}
          </Button>
          <Button onClick={() => writeUp.mutate()} disabled={writeUp.isPending}>
            {writeUp.isPending ? 'Writing up…' : 'Write it up'}
          </Button>
        </div>
      </div>

      <div className="tone-rule mt-6 h-px w-full" />

      {!item ? (
        <Empty title="This agenda has no items" reason="Add some and come back." />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div>
            <div className="paper px-6 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <p className="eyebrow">
                    Item {current + 1} of {agenda.items.length}
                  </p>
                  <h2 className="mt-1 font-display text-2xl">{item.title}</h2>
                </div>
                <p
                  className={`font-display text-3xl tabular-nums ${over ? 'text-flame' : 'text-muted-foreground'}`}
                >
                  <Clock className="mr-2 inline h-5 w-5" aria-hidden />
                  {mmss}
                  <span className="ml-2 text-base font-normal">of {item.minutes}:00</span>
                </p>
              </div>

              {over && (
                <p className="mt-3 text-sm text-flame">
                  Over by {Math.floor((elapsed - allotted) / 60)}m{' '}
                  {String((elapsed - allotted) % 60).padStart(2, '0')}s. Nothing will stop on its
                  own — you know something the clock does not.
                </p>
              )}

              <div className="mt-5 space-y-2">
                <Label htmlFor="item-note">What happened</Label>
                <Textarea
                  id="item-note"
                  rows={5}
                  value={notes[current] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [current]: e.target.value })}
                  placeholder="The decision, the number, who is doing what by when."
                />
                <p className="text-xs text-muted-foreground">
                  About the item, not about a person. This becomes the minutes.
                </p>
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  variant="outline"
                  disabled={current === 0}
                  onClick={() => setCurrent((n) => n - 1)}
                >
                  Back
                </Button>
                <Button
                  disabled={current >= agenda.items.length - 1}
                  onClick={() => {
                    save.mutate({});
                    setCurrent((n) => n + 1);
                  }}
                >
                  Next item
                </Button>
              </div>
            </div>

            <Section title="The rest of the agenda" className="mt-8">
              <ul className="space-y-1">
                {agenda.items.map((it, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={`flex w-full items-baseline justify-between gap-4 rounded px-3 py-2 text-left hover:bg-foreground/5 ${
                        i === current ? 'bg-foreground/5 font-medium' : ''
                      }`}
                    >
                      <span>
                        {i + 1}. {it.title}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {notes[i]?.trim() ? 'noted · ' : ''}
                        {it.minutes}m
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Stack />
        </div>
      )}

      <Guarantee>
        The agenda and your notes are saved. The stack is not, and there is no route in this
        product that would accept it — a record of who was in a room and how much each of them said
        is the most damaging document a group could make about itself, and it is worth nothing the
        morning after.
      </Guarantee>
    </>
  );
}

/**
 * The speaking stack.
 *
 * Plain state. No query, no mutation, no key in localStorage — closing the tab
 * is the deletion, which is the only deletion guarantee that needs no trust.
 */
function Stack() {
  const [stack, setStack] = useState<string[]>([]);
  const [name, setName] = useState('');

  return (
    <aside className="paper h-fit px-5 py-4">
      <h2 className="font-display text-xl">Stack</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Who is next. This never leaves your browser — it is not saved, not sent, and closing the
        tab is the end of it.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = name.trim();
          if (!clean) return;
          setStack([...stack, clean.slice(0, 60)]);
          setName('');
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Who put their hand up"
          aria-label="Add to the stack"
        />
        <Button type="submit" size="icon" aria-label="Add to the stack">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {stack.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nobody is waiting.</p>
      ) : (
        <ol className="mt-4 space-y-1">
          {stack.map((person, i) => (
            <li
              key={`${person}-${i}`}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-foreground/5"
            >
              <span className="w-5 shrink-0 text-muted-foreground">{i + 1}.</span>
              <span className="flex-1">{person}</span>
              <button
                type="button"
                aria-label={`${person} has spoken`}
                onClick={() => setStack(stack.filter((_, n) => n !== i))}
                className="text-muted-foreground hover:text-foreground"
              >
                <Check className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {stack.length > 0 && (
        <button
          type="button"
          onClick={() => setStack([])}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear the stack
        </button>
      )}
    </aside>
  );
}
