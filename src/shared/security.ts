/**
 * The security posture, as data.
 *
 * There was no security page — only a link to security.txt in the footer, which
 * tells a researcher where to send a report and tells a prospective customer
 * nothing at all. For a product whose entire argument is "we hold less than the
 * alternative", that was the wrong gap to have.
 *
 * ---------------------------------------------------------------------------
 * Who is reading this, and what a "check" actually is
 * ---------------------------------------------------------------------------
 *
 * The reader is a tenant organizer deciding whether to move their group's
 * records here. They are not an engineer. If a sentence needs a computer
 * science degree, it has failed at the only job it has, no matter how true it
 * is.
 *
 * The first version of this file got that wrong in a way worth naming, because
 * the mistake is easy to make again. Every control carried a `verify` field,
 * and every `verify` field was a paragraph of implementation: the name of the
 * key-derivation function and its iteration count, which database privilege the
 * isolation rests on not having, the two-pass structure of the redaction pass,
 * which of our connections is the privileged one and which jobs it is bound to.
 *
 * That failed twice over.
 *
 * It was unreadable — none of it means anything to the person the page is for.
 * And none of it was verification. A reader cannot check an iteration count. It
 * was our own assertion about our own internals, wearing the costume of proof,
 * which is precisely the move the page exists to refuse.
 *
 * So the field is now `check`, and it holds something the reader can do, or a
 * dated artifact that will say. "Change your passphrase and watch your notes
 * stay readable" is a check. "PBKDF2 at 600,000 iterations" is a disclosure.
 *
 * ---------------------------------------------------------------------------
 * The second reason, which is not editorial
 * ---------------------------------------------------------------------------
 *
 * Coram's customers are people a state has an active interest in. A public page
 * that names the exact mechanism each boundary rests on, and points at which
 * path holds the privileged credential, is a starting map for anyone who wants
 * through — written by us, kept current by us, and indexed.
 *
 * The commitments stay public and specific. The mechanism does not. What is
 * true is publishable; how it is built is not, and an auditor under NDA is the
 * right reader for the second kind. security.test.ts holds the line with a
 * vocabulary list, because this file will be edited by someone who knows how it
 * all works and will not notice themselves explaining it.
 */

export interface Control {
  id: string;
  /** Plain language. What the reader gets, not what we implemented. */
  title: string;
  /** Two sentences at most, and no word a non-technical reader would skip. */
  claim: string;
  /**
   * Something the reader can do, or an artifact with a date on it that will
   * say. Never a description of the mechanism, and never "trust us".
   */
  check: string;
}

export const CONTROLS: Control[] = [
  {
    id: 'rls',
    title: 'Your group’s records cannot reach another group',
    claim:
      'Every workspace is sealed off from every other one. That seal is not a rule Coram is ' +
      'supposed to remember to follow — it sits underneath the whole product, so a mistake in ' +
      'one screen cannot walk around it.',
    check:
      'This is the first thing the independent review is scoped to cover, and the review is ' +
      'published in full. Until it exists, /trust says so outright instead of implying otherwise.',
  },
  {
    id: 'no-service-role',
    title: 'There is no master key behind the screens you use',
    claim:
      'Nothing that answers when you load a page has the ability to ask for someone else’s ' +
      'records. Not for a support ticket, not for a debugging session, not for us.',
    check:
      'Ask us to look something up in another workspace for you. The answer is that we cannot, ' +
      'and it is the same answer every time, because there is nothing to make an exception with.',
  },
  {
    id: 'ciphertext',
    title: 'Messages and notes we are unable to read',
    claim:
      'Your channel messages and your organiser notes are scrambled on your own device before ' +
      'they ever reach us. We hold the scrambled version and nothing that would open it. Served ' +
      'with a warrant for them, we would hand over noise, and we would tell you we had.',
    check:
      'Change your workspace passphrase. Every message and every note stays readable to you ' +
      'straight away, and nothing gets re-uploaded to make that happen — which is only possible ' +
      'if the readable version was never ours to begin with. It takes about a minute.',
  },
  {
    id: 'passwords',
    title: 'Your password is not written down anywhere',
    claim:
      'We keep something that can confirm you typed your password correctly and cannot be turned ' +
      'back into the password. If our database were stolen tonight, it would not hand anyone the ' +
      'password you use — here or on the other sites people reuse it on.',
    check:
      'Ask us to send you your password. We will tell you we are not able to, and that refusal ' +
      'is the thing working. You can reset it; nobody, us included, can read it.',
  },
  {
    id: 'retention',
    title: 'Nothing is kept just because deleting it is effort',
    claim:
      'Every kind of record here has a written expiry and a stated reason for it. The ones with ' +
      'a finite life are deleted on a schedule, by a machine, not when somebody gets round to it.',
    check:
      'Ask what we keep and for how long, about any specific thing in the product, and you get ' +
      'an answer in writing. A new feature that has no answer for its data does not ship — that ' +
      'is a build step, not an intention.',
  },
  {
    id: 'burn',
    title: 'You can destroy a workspace, and mean it',
    claim:
      'A steward can end a workspace outright. The records are removed rather than hidden behind ' +
      'a flag, the uploaded files go with them, and our backups are short enough — a day at the ' +
      'outside — that no copy quietly outlives the decision.',
    check:
      'Export first: the export is built to be complete, so leaving is not the same as losing. ' +
      'Then destroy it, and try to sign back in. Nothing about that is reversible by us either.',
  },
  {
    id: 'redaction',
    title: 'The writing assistant is never told who anyone is',
    claim:
      'When Coram helps you draft a flyer or a letter, the people in it are taken out first. The ' +
      'assistant sees "the tenant" where your draft has a name, and the names are put back on ' +
      'your own screen afterwards. It is not that we ask it not to look — it is not given them.',
    check:
      'Draft something with real names and addresses in it and read what comes back. If a name ' +
      'ever survives where it should not have, that is a security report and we want it; the ' +
      'address is at the bottom of this page.',
  },
  {
    id: 'least-privilege',
    title: 'The automatic jobs are given as little as possible',
    claim:
      'The background work that keeps public facts current — who represents your district, when ' +
      'the council next sits — can touch those public facts and nothing else. It cannot see a ' +
      'contact, a workspace, or a word anyone typed.',
    check:
      'Also inside the scope of the published independent review. It is the kind of thing that ' +
      'is easy to claim and hard to fake in front of somebody looking.',
  },
];

/** What is missing, and what we do instead. */
export interface Gap {
  id: string;
  title: string;
  /** The gap itself, said without cushioning. */
  claim: string;
  /** What we do about it, or why it is not fixable. */
  instead: string;
}

/**
 * What we do not have.
 *
 * This half is the point. Every security page lists controls; the ones worth
 * trusting say what is missing, because a reader who finds a gap themselves
 * stops believing the rest.
 */
export const ABSENT: Gap[] = [
  {
    id: 'pentest',
    title: 'Nobody outside this project has tried to break it',
    claim:
      'There has been no independent penetration test. This is the largest gap on the page and ' +
      'it belongs at the top of it.',
    instead:
      'The commitment is an annual independent review, published in full and including the ' +
      'findings we have not fixed yet. /trust currently says that nothing has been published, ' +
      'because nothing has, and it will keep saying so until that changes.',
  },
  {
    id: 'soc2',
    title: 'Our SOC 2 review is our own, not an auditor’s',
    claim:
      'We have gone through the SOC 2 criteria ourselves, control by control, and we are working ' +
      'the results in order of how bad they were. Nobody independent has signed any of it, so ' +
      'there is no badge on this page — a badge would mean something we have not earned.',
    instead:
      'Marking your own homework is worth doing and worth exactly what it sounds like. What it ' +
      'has been good for is an honest written list of where we are weak, and several of the ' +
      'things on that list are already fixed. A real audit costs more than this project has, and ' +
      'no grassroots group has asked us for one; if a union or a funded coalition makes it a ' +
      'condition, we will pay for it and say so here.',
  },
  {
    id: 'not-open-source',
    title: 'You cannot read the code',
    claim:
      'Coram is closed source. That takes something real away from every claim above, and we are ' +
      'not going to pretend it does not.',
    instead:
      'What we offer in its place is a review we publish rather than a repository to read, a ' +
      'warrant canary signed by a person who is free to decline to sign it, and export tooling ' +
      'good enough that walking away costs you nothing.',
  },
  {
    id: 'metadata',
    title: 'We can still see the shape of your organising',
    claim:
      'Scrambling hides what your messages say. It does not hide that your workspace exists, ' +
      'roughly how many people are in it, or which weeks it is busy.',
    instead:
      'Nothing fixes this while we are the ones hosting it, and anyone who tells you otherwise ' +
      'is selling something. It is why the export path matters and why the canary exists.',
  },
];

/** Where to send a report, and what happens then. */
export const DISCLOSURE = {
  contact: 'security@coram.app',
  wellKnown: '/.well-known/security.txt',
  commitments: [
    'We answer within three working days.',
    'We will not threaten a researcher who acts in good faith, and being thanked will never be ' +
      'conditional on staying quiet.',
    'We publish findings we have not fixed, including in the annual review.',
    'If a flaw exposed a workspace’s data, the people in that workspace are told what happened ' +
      'and when — whether or not any law requires it of us.',
  ],
} as const;
