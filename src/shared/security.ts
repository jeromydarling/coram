/**
 * The security posture, as data.
 *
 * There was no security page — only a link to security.txt in the footer, which
 * tells a researcher where to send a report and tells a prospective customer
 * nothing at all. For a product whose entire argument is "we hold less than the
 * alternative", that was the wrong gap to have.
 *
 * Written as records rather than prose for the same reason the acceptable use
 * policy is: a claim with a `verify` field is one a reader can check, and one we
 * cannot quietly stop honouring. Several of these are asserted by tests in this
 * repo, and where that is true the record says which — a control nobody tests is
 * a control that has already drifted.
 *
 * The hardest rule here is the last section. `ABSENT` lists what we do not have,
 * including the things a procurement questionnaire asks for. A security page
 * that lists only strengths is marketing; the omissions are what make the rest
 * of it worth reading.
 */

export interface Control {
  id: string;
  title: string;
  /** What is true, in one sentence someone non-technical can follow. */
  claim: string;
  /** How a reader could confirm it, or what enforces it. Never "trust us". */
  verify: string;
}

export const CONTROLS: Control[] = [
  {
    id: 'rls',
    title: 'Isolation is in the database, not the code',
    claim:
      'Every table carries a workspace id and denies access by default. One workspace cannot ' +
      'read another’s rows even if the application asks it to.',
    verify:
      'Postgres row-level security, ENABLE and FORCE on every table. The Worker connects as a ' +
      'role that is not the table owner and does not hold BYPASSRLS, because a table owner ' +
      'silently ignores RLS and we did not want the boundary resting on us remembering that.',
  },
  {
    id: 'no-service-role',
    title: 'No god-mode in the request path',
    claim:
      'Nothing that answers a request can bypass those rules. The privileged connection exists ' +
      'only for the nightly sweep, and request handlers hold no credential for it.',
    verify:
      'Two separate database configurations with different users. The privileged one is bound ' +
      'only to scheduled jobs and queue consumers.',
  },
  {
    id: 'ciphertext',
    title: 'Some things we hold only as ciphertext',
    claim:
      'Channel messages and organiser notes are encrypted before they leave your browser. We ' +
      'hold the ciphertext and never the key, so we cannot read them and cannot be made to.',
    verify:
      'A passphrase derives a key that wraps a per-workspace data key; the wrapped key is what ' +
      'we store. Rotating the passphrase re-wraps it without touching a single note — which is ' +
      'only possible because we never had the plaintext.',
  },
  {
    id: 'passwords',
    title: 'Passwords are slow to test and never stored',
    claim: 'We store a verifier, not your password, and it is deliberately expensive to guess.',
    verify:
      'PBKDF2-HMAC-SHA256 at 600,000 iterations, the OWASP figure, with a per-user salt. The ' +
      'iteration count is stored alongside so it can be raised without locking anyone out.',
  },
  {
    id: 'retention',
    title: 'Every table has to justify how long it keeps things',
    claim:
      'No table can exist without a written retention position and a stated reason. Data with a ' +
      'finite life is deleted by a nightly job, not by someone remembering.',
    verify:
      'A registry in the codebase that continuous integration checks against the migrations. A ' +
      'migration that adds a table without registering it fails the build — the check runs ' +
      'before the tests, on purpose.',
  },
  {
    id: 'burn',
    title: 'Deletion means the rows are gone',
    claim:
      'A steward can destroy a workspace. Records are deleted rather than flagged, and the files ' +
      'go with them.',
    verify:
      'Cascading deletes plus a queued job that walks object storage. Backups are capped at 24 ' +
      'hours so a snapshot cannot outlive the promise.',
  },
  {
    id: 'redaction',
    title: 'Nothing personal reaches a model',
    claim:
      'The writing assistant never sees a name, an address, or a phone number. They are removed ' +
      'before the request leaves us and put back in your browser afterwards.',
    verify:
      'Two passes — your own roster matched exactly, then patterns for anything else — followed ' +
      'by a check that refuses to open a connection if anything personal survived. The check ' +
      'runs over the system prompt too, which is the one people forget.',
  },
  {
    id: 'least-privilege',
    title: 'Automated jobs get the narrowest credential that works',
    claim:
      'The job that refreshes public legislative rosters can write four tables of published ' +
      'facts and read nothing else — not contacts, not workspaces, not the audit log.',
    verify:
      'A dedicated database role, granted table by table rather than by schema. Its isolation ' +
      'was confirmed against the live database before the job was scheduled, and the deployment ' +
      'guide carries the two queries an operator can re-run to check it still holds.',
  },
];

/**
 * What we do not have.
 *
 * This half is the point. Every security page lists controls; the ones worth
 * trusting say what is missing, because a reader who finds a gap themselves
 * stops believing the rest.
 */
export const ABSENT: Control[] = [
  {
    id: 'soc2',
    title: 'No SOC 2',
    claim: 'We have not been audited against SOC 2 and do not claim to be.',
    verify:
      'Type 1 runs roughly $20k–$45k and Type 2 considerably more. No grassroots group has ever ' +
      'asked us for it. We will revisit when a union or a funded coalition makes it a condition, ' +
      'and we will say so here when that happens.',
  },
  {
    id: 'pentest',
    title: 'No independent penetration test yet',
    claim: 'Nobody outside this project has tried to break it.',
    verify:
      'This is the most significant gap on the page. The commitment is an annual independent ' +
      'review published on /trust, including findings we have not fixed — and /trust currently ' +
      'says plainly that nothing has been published, because nothing has.',
  },
  {
    id: 'not-open-source',
    title: 'You cannot read the code',
    claim:
      'Coram is closed source. That is a real cost to a claim like the ones above, and we are ' +
      'not going to pretend otherwise.',
    verify:
      'What we offer instead is an audit we publish rather than a repository, a warrant canary ' +
      'signed by a person, and export tooling so that leaving does not mean losing anything.',
  },
  {
    id: 'metadata',
    title: 'We can still see metadata',
    claim:
      'Encryption hides message contents. It does not hide that a workspace exists, roughly how ' +
      'large it is, or when it is busy.',
    verify:
      'Nothing can fix this at the architecture level while we host the service. It is why the ' +
      'export and self-host path matters, and why the canary exists.',
  },
];

/** Where to send a report, and what happens then. */
export const DISCLOSURE = {
  contact: 'security@coram.app',
  wellKnown: '/.well-known/security.txt',
  commitments: [
    'We acknowledge a report within three working days.',
    'We will not threaten a researcher who acts in good faith, and we will not ask anyone to ' +
      'stay quiet as a condition of being thanked.',
    'We publish findings we have not fixed, including in the annual review.',
    'If a vulnerability exposed workspace data, the affected workspaces are told what happened ' +
      'and when, whether or not any law requires it.',
  ],
} as const;
