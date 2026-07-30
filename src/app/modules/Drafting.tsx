/**
 * Scriba (§5.10) — a model that never sees a name.
 *
 * §5.10's hard rule: redact all PII server-side before dispatch, reinsert
 * client-side. That is why this screen exists as a screen at all rather than as
 * a button inside the composer — the reinsertion happens here, in the browser,
 * from a map the model was never given, and the person is shown what was
 * removed before they use a word of it.
 *
 * Three things are always visible at the point of use, because a promise made
 * in a policy page is a promise nobody reads:
 *   - what was taken out and put back
 *   - what the model invented and left as a blank for a human to fill
 *   - what redaction could not verify, which is the honest part
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Failed } from '@/components/coram/State';
import { api, postWithNotice, type EventRow, type ProposalRow } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';

const MODULE = MODULES.find((m) => m.path === '/drafting')!;

interface DraftResult {
  draft?: string;
  summary?: string;
  minutes?: string;
  refused?: boolean;
  reason?: string;
  response?: string;
  redactions?: Record<string, string>;
  removed?: number;
  invented?: string[];
  unverified?: string[];
}

export function Drafting() {
  return (
    <>
      <PageHeader
        module={MODULE}
        title="Drafting"
        description="Help writing the thing you already know you want to say. Names and contact details are stripped before anything leaves, and put back in your browser."
      />

      <Tabs defaultValue="message">
        <TabsList className="mb-6">
          <TabsTrigger value="message">A message</TabsTrigger>
          <TabsTrigger value="summary">Event summary</TabsTrigger>
          <TabsTrigger value="minutes">Minutes</TabsTrigger>
        </TabsList>

        <TabsContent value="message">
          <Composer />
        </TabsContent>
        <TabsContent value="summary">
          <FromRecord kind="summarise" />
        </TabsContent>
        <TabsContent value="minutes">
          <FromRecord kind="minutes" />
        </TabsContent>
      </Tabs>

      <Guarantee>
        Coram routes this to a private model and no tenant data is ever used to train anything. The
        model does not receive names, email addresses, phone numbers or postal codes — it receives
        placeholders, and this page puts the real values back after the answer comes home.
      </Guarantee>
    </>
  );
}

function Composer() {
  const [intent, setIntent] = useState('');
  const [channel, setChannel] = useState('email');
  const [result, setResult] = useState<DraftResult | null>(null);
  const [notice, setNotice] = useState<string>();

  const draft = useMutation({
    mutationFn: () => postWithNotice<DraftResult>('/scriba/draft', { intent, channel }),
    onSuccess: (r) => {
      setResult(r.data);
      setNotice(r.notice);
    },
    onError: (e: Error) => failed('The model did not answer', e),
  });

  return (
    <>
      <Section title="What do you want to say?">
        <Textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={5}
          placeholder="Tell everyone in the north turf the hearing moved to Thursday and we need forty people in the room."
          aria-label="What do you want to say"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="channel">For</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">An email</SelectItem>
                <SelectItem value="sms">A text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!intent.trim() || draft.isPending} onClick={() => draft.mutate()}>
            <Sparkles className="mr-2 h-4 w-4" />
            {draft.isPending ? 'Writing…' : 'Draft it'}
          </Button>
        </div>
      </Section>

      {result && <Result result={result} notice={notice} text={result.draft} />}
    </>
  );
}

/** Summaries and minutes both take one id and give back one block of prose. */
function FromRecord({ kind }: { kind: 'summarise' | 'minutes' }) {
  const [id, setId] = useState<string>();
  const [result, setResult] = useState<DraftResult | null>(null);
  const [notice, setNotice] = useState<string>();

  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => api<EventRow[]>('/events'),
    enabled: kind === 'summarise',
  });
  const proposals = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api<ProposalRow[]>('/consilium/proposals'),
    enabled: kind === 'minutes',
  });

  const run = useMutation({
    mutationFn: () =>
      postWithNotice<DraftResult>(
        `/scriba/${kind}`,
        kind === 'summarise' ? { eventId: id } : { proposalId: id },
      ),
    onSuccess: (r) => {
      setResult(r.data);
      setNotice(r.notice ?? r.meta?.message as string | undefined);
    },
    onError: (e: Error) => failed('The model did not answer', e),
  });

  const options =
    kind === 'summarise'
      ? (events.data ?? []).map((e) => ({ id: e.id, label: e.title }))
      : (proposals.data ?? []).map((p) => ({ id: p.id, label: p.title }));

  return (
    <>
      <Section
        title={kind === 'summarise' ? 'Which event?' : 'Which proposal?'}
        hint={
          kind === 'summarise'
            ? 'Coram sends counts, never a list of who came. The prompt is shorter and there is far less for redaction to get wrong.'
            : 'The proposal, its ballot and the number of comments. Not the comments themselves.'
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <Select value={id} onValueChange={setId}>
            <SelectTrigger className="w-80" aria-label="Choose a record">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!id || run.isPending} onClick={() => run.mutate()}>
            <Sparkles className="mr-2 h-4 w-4" />
            {run.isPending ? 'Writing…' : kind === 'summarise' ? 'Summarise' : 'Draft minutes'}
          </Button>
        </div>
        {options.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Nothing to work from yet.</p>
        )}
      </Section>

      {result && (
        <Result result={result} notice={notice} text={result.summary ?? result.minutes} />
      )}
    </>
  );
}

function Result({
  result,
  notice,
  text,
}: {
  result: DraftResult;
  notice?: string;
  text?: string;
}) {
  if (result.refused) {
    return (
      <Section title="We did not send that">
        <Failed
          error={new Error(result.response ?? result.reason ?? 'That is outside what Coram drafts.')}
          what="Refused before it reached the model"
        />
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This check runs in Coram, before dispatch. It is not the model declining — it is us, on
          the acceptable-use policy the workspace agreed to.
        </p>
      </Section>
    );
  }

  if (!text) return null;

  return (
    <Section
      title="The draft"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            say('Copied.');
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </Button>
      }
    >
      <div className="paper px-5 py-4">
        <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{text}</p>
      </div>

      {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}

      {typeof result.removed === 'number' && result.removed > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {result.removed} name{result.removed === 1 ? '' : 's'} or contact detail
          {result.removed === 1 ? '' : 's'} were replaced with placeholders before this was sent,
          and restored in your browser afterwards.
        </p>
      )}

      {result.invented && result.invented.length > 0 && (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/[0.08] px-5 py-4">
          <p className="text-sm font-medium">The model made these up</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            It invented placeholders we never gave it. They have been blanked out — fill them in
            yourself rather than trusting what it guessed:{' '}
            {result.invented.map((i) => (
              <Badge key={i} variant="secondary" className="mr-1 font-normal">
                {i}
              </Badge>
            ))}
          </p>
        </div>
      )}

      {result.unverified && result.unverified.length > 0 && (
        <div className="mt-4 rounded-lg border px-5 py-4">
          <p className="text-sm font-medium">What we could not check</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Redaction matches against your own contact list and against patterns. These words look
            like names but are not in either, so we cannot promise they were removed. Read the draft
            before you send it:{' '}
            {result.unverified.slice(0, 12).map((u) => (
              <Badge key={u} variant="outline" className="mr-1 font-normal">
                {u}
              </Badge>
            ))}
          </p>
        </div>
      )}
    </Section>
  );
}
