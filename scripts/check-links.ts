/**
 * Check every link the field guide would send an organizer to.
 *
 * Run: npx tsx scripts/check-links.ts [--json]
 *
 * This exists because of Pennsylvania. Its bill drafting manual — 101 Pa. Code
 * Chapter 13 — was deleted on 1 May 2026 and now reads "{Reserved}". That was
 * nine weeks before the research ran, and it was caught only because the agent
 * doing Pennsylvania happened to fetch the URL rather than cite it. Nothing in
 * the product would have noticed, and an organizer would have clicked through to
 * an empty page while being told it was their state's drafting manual.
 *
 * Link rot is the one kind of staleness that is fully detectable, so it should
 * never be the kind that reaches a user.
 *
 * ---------------------------------------------------------------------------
 * What it does not do
 * ---------------------------------------------------------------------------
 *
 * It cannot tell you a signature threshold changed — see
 * src/shared/legislative/freshness.ts for how that is handled. And it cannot
 * tell a live page from a live page whose content was replaced: Pennsylvania's
 * "{Reserved}" would return 200 today. So this is a floor, not a guarantee, and
 * a 200 here is not a promise that the document behind it still says what it
 * said in July 2026.
 *
 * ---------------------------------------------------------------------------
 * Why a failure is reported rather than thrown
 * ---------------------------------------------------------------------------
 *
 * Several state hosts refuse automated clients outright — Arizona, Georgia,
 * Connecticut, Nevada and Alaska all did during the research. A checker that
 * exits non-zero on those would fail every scheduled run and be switched off
 * within a fortnight, which is worse than no checker. So 403 and 405 are
 * reported as "blocked", counted separately, and do not fail the run. A 404 or a
 * 410 does.
 */

import { allLinks } from '../src/shared/legislative/freshness';

type Verdict = 'ok' | 'gone' | 'blocked' | 'error';

interface Result {
  code: string;
  field: string;
  url: string;
  status: number | null;
  verdict: Verdict;
  detail?: string;
}

const CONCURRENCY = 8;
const TIMEOUT_MS = 25_000;

/**
 * A browser-ish user agent, on purpose.
 *
 * Not to evade anything — these are public government documents and we are
 * reading one byte of each. Several state hosts serve a challenge page to
 * clients with no user agent, and the alternative is a report that says
 * "blocked" for a dozen states that are perfectly fine.
 */
const HEADERS = {
  /*
   * ASCII only. The first version of this string had an em dash in it and every
   * one of the 250 checks failed with "Cannot convert argument to a ByteString",
   * because HTTP header values are latin-1. All 250 landed in the `blocked`
   * bucket and read exactly like hostile government hosts — which is the lesson
   * worth keeping: `blocked` is where a bug in this checker goes to hide, so a
   * run where everything is blocked is a broken checker, not a broken internet.
   */
  'User-Agent':
    'Mozilla/5.0 (compatible; Coram link check; +https://coram.app) verifying published legislative links',
  Accept: '*/*',
};

async function check(link: { code: string; field: string; url: string }): Promise<Result> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    /*
     * GET, not HEAD. A depressing number of government hosts answer HEAD with
     * 405 or with a status that disagrees with the GET, so HEAD produces a
     * report full of failures that are not real.
     */
    const res = await fetch(link.url, {
      method: 'GET',
      headers: HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    // Read nothing. The status is the whole answer and some of these are 400-page PDFs.
    await res.body?.cancel();

    let verdict: Verdict = 'ok';
    if (res.status === 404 || res.status === 410) verdict = 'gone';
    else if (res.status === 403 || res.status === 405 || res.status === 429) verdict = 'blocked';
    else if (res.status >= 400) verdict = 'error';

    return { ...link, status: res.status, verdict };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // A TLS failure or a dead host is worth knowing about but is not proof the
    // document is gone — several of these hosts are simply hostile to scripts.
    return { ...link, status: null, verdict: 'blocked', detail };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const links = allLinks();
  const results: Result[] = [];

  for (let i = 0; i < links.length; i += CONCURRENCY) {
    const batch = links.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(check))));
    process.stderr.write(`\rchecked ${Math.min(i + CONCURRENCY, links.length)}/${links.length}`);
  }
  process.stderr.write('\n');

  const gone = results.filter((r) => r.verdict === 'gone');
  /*
   * If essentially nothing came back, suspect this script before suspecting
   * fifty state governments. See the note on HEADERS.
   */
  const okCount = results.filter((r) => r.verdict === 'ok').length;
  if (results.length > 20 && okCount === 0) {
    console.error(
      `All ${results.length} checks failed. That is almost certainly a bug in this script rather ` +
        `than every source going down at once — check the request headers first.`,
    );
    process.exitCode = 1;
    return;
  }
  const blocked = results.filter((r) => r.verdict === 'blocked');
  const errored = results.filter((r) => r.verdict === 'error');

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  } else {
    console.log(
      `\n${results.length} links: ${results.length - gone.length - blocked.length - errored.length} ok, ` +
        `${gone.length} gone, ${errored.length} erroring, ${blocked.length} blocked to scripts.`,
    );

    if (gone.length) {
      console.log('\nGONE — a link in the field guide that no longer resolves:');
      for (const r of gone) console.log(`  ${r.code} ${r.field}  ${r.status}  ${r.url}`);
    }
    if (errored.length) {
      console.log('\nERRORING:');
      for (const r of errored) console.log(`  ${r.code} ${r.field}  ${r.status}  ${r.url}`);
    }
    if (blocked.length) {
      console.log('\nBLOCKED to automated clients (not evidence of a dead link):');
      for (const r of blocked) {
        console.log(`  ${r.code} ${r.field}  ${r.status ?? r.detail?.slice(0, 40)}  ${r.url}`);
      }
    }
  }

  /*
   * Only a link that is definitively gone fails the run. Blocked hosts are the
   * normal state of affairs for state government sites and failing on them would
   * mean a check nobody trusts.
   */
  if (gone.length) {
    console.error(
      `\n${gone.length} link(s) are gone. Fix the record in research/legislative/states/ and ` +
        `re-run \`npx tsx scripts/compile-pathways.ts\`. A null is a correct answer — do not ` +
        `substitute a lookalike document from another state.`,
    );
    process.exitCode = 1;
  }
}

await main();
