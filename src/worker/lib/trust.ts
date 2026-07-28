/**
 * trust — the four transparency artifacts (§7).
 *
 * §7: each artifact shows a live "last updated" date pulled from the database,
 * and "a stale artifact is worse than no artifact, so the page must visibly
 * flag its own staleness."
 *
 * These live in KV rather than in Postgres, and that is a deliberate departure
 * from where §7 says to put them. Every table in this product carries a
 * `tenant_id` (§4.2) and every table registers a retention rule (§3.4); these
 * four values belong to the platform rather than to any workspace, so a table
 * for them would be the first exception to both invariants. Four keys in KV are
 * a smaller cost than a hole in a rule that everything else depends on.
 *
 * The honesty rules encoded here:
 *
 *   - An artifact that has never been published says so. It does not say
 *     "coming soon", and there is no way to mark one as published without
 *     giving it a URL.
 *   - An artifact past its cadence is flagged as overdue on the public page,
 *     automatically, with no way to suppress it from the application.
 *   - The canary is never auto-signed. §7 is explicit, and the reason is that
 *     a canary's entire value rests on a person being free to decline to sign.
 */

import type { Env } from '../env';

export type ArtifactKind = 'security_audit' | 'transparency_report' | 'canary' | 'export_docs';

export type Staleness = 'never_published' | 'current' | 'due' | 'overdue';

export interface Artifact {
  kind: ArtifactKind;
  title: string;
  /** What §7 promises about how often this appears. */
  cadence: string;
  /** Days after which it is due, then overdue. */
  dueDays: number;
  overdueDays: number;
  publishedAt: string | null;
  url: string | null;
  /** Shown under the title. Plain language, no marketing. */
  description: string;
}

/** The four, exactly as §7 lists them. */
const ARTIFACTS: Array<Omit<Artifact, 'publishedAt' | 'url'>> = [
  {
    kind: 'security_audit',
    title: 'Independent security audit',
    cadence: 'Annual',
    dueDays: 365,
    overdueDays: 455,
    description:
      'Published in full, including findings we have not fixed yet. Scope: multi-tenant ' +
      'isolation, the API, cloud IAM, and CI/CD.',
  },
  {
    kind: 'transparency_report',
    title: 'Transparency report',
    cadence: 'Semiannual',
    dueDays: 183,
    overdueDays: 245,
    description:
      'Subpoenas received, complied with, and challenged. How many users we were able to ' +
      'notify.',
  },
  {
    kind: 'canary',
    title: 'Warrant canary',
    cadence: 'Quarterly',
    // §7 names these two numbers directly.
    dueDays: 100,
    overdueDays: 120,
    description:
      'A short signed statement that no secret subpoena has been served. We publish the ' +
      'cadence so that silence is itself the signal.',
  },
  {
    kind: 'export_docs',
    title: 'Export and self-host documentation',
    cadence: 'Every major release',
    dueDays: 365,
    overdueDays: 545,
    description:
      'How to take everything with you, and how to run this yourself. Kept current because ' +
      'an export nobody can use is not an export.',
  },
];

interface StoredArtifact {
  publishedAt: string;
  url: string | null;
}

function key(kind: ArtifactKind): string {
  return `trust:${kind}`;
}

async function hydrate(
  env: Env,
  definition: (typeof ARTIFACTS)[number],
): Promise<Artifact> {
  const raw = await env.KV_FLAGS.get(key(definition.kind));
  let stored: StoredArtifact | null = null;

  try {
    stored = raw ? (JSON.parse(raw) as StoredArtifact) : null;
  } catch {
    // A corrupted value reads as never published. Better a page that
    // understates what exists than one that claims an audit we cannot show.
    stored = null;
  }

  return {
    ...definition,
    publishedAt: stored?.publishedAt ?? null,
    url: stored?.url ?? null,
  };
}

/** Every artifact, with whatever has actually been published. */
export async function loadArtifacts(env: Env): Promise<Artifact[]> {
  return Promise.all(ARTIFACTS.map((definition) => hydrate(env, definition)));
}

/**
 * One artifact. The cron job uses this so that the clock it watches and the
 * date `/trust` renders are the same value — two stores for one fact would let
 * the page and the alert disagree, and the page is the one people read.
 */
export async function loadArtifact(env: Env, kind: ArtifactKind): Promise<Artifact> {
  const definition = ARTIFACTS.find((a) => a.kind === kind);
  if (!definition) throw new Error(`No such trust artifact: ${kind}`);
  return hydrate(env, definition);
}

export function ageInDays(artifact: Artifact, now = Date.now()): number | null {
  if (!artifact.publishedAt) return null;
  const published = Date.parse(artifact.publishedAt);
  if (Number.isNaN(published)) return null;
  return Math.floor((now - published) / 86_400_000);
}

export function staleness(artifact: Artifact, now = Date.now()): Staleness {
  const age = ageInDays(artifact, now);
  if (age === null) return 'never_published';
  if (age >= artifact.overdueDays) return 'overdue';
  if (age >= artifact.dueDays) return 'due';
  return 'current';
}

/**
 * One sentence about where an artifact stands, for the public page.
 *
 * "Overdue" is stated plainly rather than softened. §7's whole argument is that
 * a page which quietly lets an artifact age is worse than no page, so this
 * wording is deliberately uncomfortable to leave up.
 */
export function describe(artifact: Artifact, now = Date.now()): string {
  const age = ageInDays(artifact, now);

  switch (staleness(artifact, now)) {
    case 'never_published':
      return 'Not published yet.';
    case 'overdue':
      return `Overdue. Last published ${artifact.publishedAt}, ${age} days ago.`;
    case 'due':
      return `Due now. Last published ${artifact.publishedAt}, ${age} days ago.`;
    default:
      return `Published ${artifact.publishedAt}.`;
  }
}

/** True if anything is overdue, so the page can say so at the top. */
export function anyOverdue(artifacts: Artifact[], now = Date.now()): boolean {
  return artifacts.some((a) => staleness(a, now) === 'overdue');
}

/**
 * Record a publication.
 *
 * Requires a URL. An artifact marked published with nowhere to read it would be
 * the exact failure §7 is written against — a page that says "audited" and
 * links to nothing.
 *
 * Deliberately not exposed as an API route. These are set with `wrangler kv
 * key put` by a person who has just published the thing, which keeps the act of
 * claiming an audit exists as deliberate as the act of commissioning one.
 */
export async function publish(
  env: Env,
  kind: ArtifactKind,
  publishedAt: string,
  url: string,
): Promise<void> {
  if (!url) throw new Error('An artifact cannot be published without somewhere to read it.');
  await env.KV_FLAGS.put(key(kind), JSON.stringify({ publishedAt, url } satisfies StoredArtifact));
}
