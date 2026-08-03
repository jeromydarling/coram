/**
 * A bill, on one page, for somebody who has four minutes.
 *
 * The document a legislative aide actually reads. It is not a summary of the
 * bill for the group's own benefit — the group has the bill — it is the thing
 * left behind after a meeting, and its whole job is to survive being read once,
 * quickly, by a person who has six other meetings today.
 *
 * ---------------------------------------------------------------------------
 * The order is the argument
 * ---------------------------------------------------------------------------
 *
 * The ask first, then the problem, then what the bill actually does, then who
 * else is behind it. Every draft one-pager an organizer writes puts the
 * organisation first and the ask last, and by then the reader has stopped. So
 * the layout does not offer a choice about the order: the first line on the
 * page is what you want this office to do.
 *
 * ---------------------------------------------------------------------------
 * Nothing invented
 * ---------------------------------------------------------------------------
 *
 * Every word here comes from the draft — the problem statement, the intent, the
 * operative sections, the endorsements the group recorded. No model writes any
 * of it. A one-pager is a document somebody signs their organisation's name to
 * and hands to a public official; a plausible sentence nobody wrote is exactly
 * the wrong kind of help.
 *
 * Private endorsements are omitted, and that is not a display preference —
 * `public: false` means an organisation supports this and has not agreed to say
 * so, and printing their name on a leave-behind is how a coalition partner
 * finds out they were outed by a piece of software.
 */

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Failed, Loading } from '@/components/coram/State';
import { api, words, type BillRow, type Workspace } from '@/lib/api';

interface BillSection {
  kind: string;
  position: number;
  heading: string | null;
  body: string;
}

interface BillDetail {
  bill: BillRow & { problem: string | null; intent: string | null };
  sections: BillSection[];
  endorsements: { id: string; org_name: string; org_url: string | null; public: boolean }[];
  routes: { kind: string; title: string; detail: string }[];
}

/** First sentence, or the whole thing if it is already short. */
function opening(text: string, max = 320): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  const stop = trimmed.slice(0, max).lastIndexOf('. ');
  return stop > 60 ? trimmed.slice(0, stop + 1) : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function OnePager() {
  const { id = '' } = useParams();
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const detail = useQuery({
    queryKey: ['bill', id],
    queryFn: () => api<BillDetail>(`/petitio/bills/${id}`),
  });

  if (detail.isLoading) return <Loading rows={5} label="Loading the draft" />;
  if (detail.isError) return <Failed error={detail.error} what="We could not load that draft" />;

  const d = detail.data!;
  const shortTitle = d.sections.find((s) => s.kind === 'short_title')?.body?.trim();
  const operative = d.sections.filter((s) => s.kind === 'operative' && s.body.trim());
  const definitions = d.sections.find((s) => s.kind === 'definitions')?.body?.trim();
  const publicEndorsements = d.endorsements.filter((e) => e.public);
  const route = d.routes.find((r) => r.kind === d.bill.route);
  const group = workspace.data?.tenant.name ?? '';

  return (
    <>
      <div className="print:hidden">
        <Link
          to="/advocacy"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to advocacy
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl">The leave-behind</h1>
            <p className="mt-2 max-w-prose text-muted-foreground">
              One page for an aide who has four minutes. Everything on it comes from your draft —
              nothing here is written for you.
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        {d.endorsements.length > publicEndorsements.length && (
          <p className="mt-5 max-w-prose text-sm text-muted-foreground">
            {d.endorsements.length - publicEndorsements.length} endorsement
            {d.endorsements.length - publicEndorsements.length === 1 ? ' is' : 's are'} not on this
            page, because {d.endorsements.length - publicEndorsements.length === 1 ? 'it is' : 'they are'}{' '}
            marked private. An organisation that supports this and has not agreed to say so in
            public does not go on a document you hand to an official.
          </p>
        )}

        <div className="tone-rule mt-6 h-px w-full" />
      </div>

      {/*
        The page itself. Deliberately narrow and set in the serif: this is a
        document, not a screen, and it should read like something a person wrote
        rather than a report something generated.
      */}
      <article className="mx-auto mt-8 max-w-[46rem] print:mt-0 print:max-w-none">
        <header className="border-b-2 border-foreground/80 pb-4">
          <p className="eyebrow">{group}</p>
          <h2 className="mt-1 font-display text-3xl leading-tight print:text-2xl">
            {shortTitle || d.bill.working_name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {d.bill.jurisdiction}
            {d.bill.locality ? ` · ${d.bill.locality}` : ''} · {words(d.bill.route)} route
            {d.bill.filed_as ? ` · filed as ${d.bill.filed_as}` : ''}
          </p>
        </header>

        {/* The ask, first, at the top, in the largest type on the page. */}
        <section className="mt-6">
          <h3 className="eyebrow">What we are asking</h3>
          <p className="mt-2 text-xl leading-snug print:text-base">
            {d.bill.intent?.trim()
              ? opening(d.bill.intent)
              : `Support ${shortTitle || d.bill.working_name}.`}
          </p>
        </section>

        {d.bill.problem?.trim() && (
          <section className="mt-6">
            <h3 className="eyebrow">Why</h3>
            <p className="mt-2 leading-relaxed">{opening(d.bill.problem, 700)}</p>
          </section>
        )}

        {operative.length > 0 && (
          <section className="mt-6">
            <h3 className="eyebrow">What it does</h3>
            <ul className="mt-2 space-y-2">
              {operative.map((s, i) => (
                <li key={i} className="flex gap-3 print:break-inside-avoid">
                  <span className="shrink-0 font-medium">{i + 1}.</span>
                  <span>
                    {s.heading && <strong className="font-medium">{s.heading}. </strong>}
                    {opening(s.body, 240)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {definitions && (
          <section className="mt-6">
            <h3 className="eyebrow">Who it covers</h3>
            <p className="mt-2 leading-relaxed">{opening(definitions, 380)}</p>
          </section>
        )}

        {publicEndorsements.length > 0 && (
          <section className="mt-6">
            <h3 className="eyebrow">Who is behind it</h3>
            <p className="mt-2 leading-relaxed">
              {publicEndorsements.map((e) => e.org_name).join(' · ')}
            </p>
          </section>
        )}

        {route && (
          <section className="mt-6">
            <h3 className="eyebrow">The route</h3>
            <p className="mt-2 leading-relaxed">
              <strong className="font-medium">{route.title}.</strong> {opening(route.detail, 300)}
            </p>
          </section>
        )}

        <footer className="mt-8 border-t border-foreground/30 pt-3 text-sm text-muted-foreground">
          {group}
          {/*
            No contact line here on purpose. Whatever a group wants an office to
            call is a decision they make per meeting, and a printed inbox that
            was right last spring is worse than a blank space somebody fills in
            by hand. The public page carries the address that is current.
          */}
          <span className="ml-2 print:inline">
            · the full text of the draft is available on request
          </span>
        </footer>
      </article>
    </>
  );
}
