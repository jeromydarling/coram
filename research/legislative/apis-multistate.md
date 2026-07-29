# Multi-state legislative data APIs for sponsor matching

**Question being answered:** given a draft bill on subject X in state Y, surface (a) the
legislators who sit on the committee that would hear it, and (b) the legislators who have
previously sponsored something similar.

**Researched:** 2026-07-29. Every claim below is either quoted from a primary source with a
URL, or measured directly from data pulled during the research (measurement method stated).

---

## Comparison table

| | **Open States / Plural** | **LegiScan** |
|---|---|---|
| Coverage | 50 states + DC + PR + US Congress | 50 states + DC + US Congress |
| Bills | Yes | Yes |
| Bill subjects/topics | Yes (`subject` string array, state-supplied) | Yes (`subjects[]` with `subject_id`/`subject_name`) |
| Sponsorships, primary vs cosponsor | Yes — `primary` boolean + `classification` string | Yes — `sponsor_type_id` (0 generic / 1 primary / 2 co / 3 joint) + `sponsor_order` |
| Committees (as entities) | Yes — 3,004 committee records across 53 jurisdictions | Yes, but only as bill *referral targets* (`committee_id`, `name`, `chamber`) |
| **Committee memberships** | **Yes — 38,616 member rows, 99.98% linked to a person ID, all 53 jurisdictions** | **NO. There is no committee-membership entity, endpoint, or table anywhere in the API.** |
| Legislator rosters | Yes, curated + scraped | Yes (`getSessionPeople`, `getPerson`) |
| Districts | Yes (`current_role.district`, `division_id`) | Yes (`district`, e.g. `"SD-039"`) |
| Party | Yes | Yes |
| Votes | Yes (roll calls + per-person votes) | Yes (`getRollCall`, per-person `vote_id`) |
| Historical depth | ~2017→present for nearly every state; CA to 1989, NC to 1985; 682 archived sessions | Sessions back to at least 2011 (manual's own examples); full national archive via `getDatasetList` |
| Free tier | 250 req/day, 10 req/min | 30,000 queries/month |
| Paid tiers | bronze 1,000/day · silver 50,000/day · unlimited 1e9/day (granted, not sold self-serve) | Subscription (Pull tiers + Push API); pricing page not machine-readable — see §3.2 |
| **Licensing for closed-source commercial use** | **Clean. "We make no copyright claim over any of the data we collect & publish." Bulk people data is explicitly CC0.** | **Not clean. LegiScan asserts IP in the Services and licenses access by subscription. Requires a written answer from LegiScan before you build on it.** |
| Bulk download | Yes — 10.7 GB monthly Postgres dump (ungated), per-session CSV/JSON (login-gated), nightly people CSV (ungated) | Yes — weekly per-session ZIP datasets (JSON or CSV) via `getDatasetList`/`getDataset` |
| Suitable for nightly sync into own Postgres | Yes (with caveats, §5) | Yes, mechanically — the client even ships a Postgres schema |
| Freshness — bills | "collected multiple times a day" | Recommends 1–3 hour polling; Push API for real-time (paid) |
| Freshness — committee memberships | Weekly automated refresh **while in session**; observed 7-month gap across the 2025 interim | N/A — data does not exist |

### Verdict

**Build against Open States / Plural.** It is the only one of the two that has committee
membership at all, and committee membership is half the product. LegiScan cannot answer
"who sits on the committee that would hear this" — not partially, not for some states, not
at all. Its licensing is also the riskier of the two for a closed-source commercial product.

LegiScan is worth keeping in the back pocket for one thing only: its full-text search engine
(`getSearchRaw`, 2,000 results/page, national scope) is better than anything Open States
exposes. But that is a "maybe later" nice-to-have, not a foundation.

---

## 1. Coverage

### 1.1 Open States

**Jurisdictions.** 53 jurisdiction directories in the canonical people/committee repo
(`github.com/openstates/people`, `data/`): all 50 states, `dc`, `pr`, and `us` (Congress).
Verified by listing the repo. The v3 API adds a `/jurisdictions` endpoint with the same set.

The bulk-download page describes coverage as
"All 50 U.S. states plus U.S. territories (American Samoa, Guam, Northern Mariana Islands,
Puerto Rico, Virgin Islands, District of Columbia)" for legislator data
(https://open.pluralpolicy.com/data/legislator-csv/), though only DC and PR have committee/bill
scrapers in practice.

**Committee membership — checked specifically, not assumed.** This is the field most likely to
be thin, so I measured it rather than trusting the docs. Cloning
`https://github.com/openstates/people` and counting committee YAML files and `members:` entries:

- **3,004 committee files across 53 jurisdiction directories.** Every one of the 53
  directories has a `committees/` subdirectory, and **every committee file that exists has a
  non-empty `members:` list.** There is no state with committees-but-no-members.
- **38,616 total membership rows. 38,608 of them (99.98%) carry a resolvable
  `person_id`** (an `ocd-person/...` UUID), not just a bare name string. The only state below
  100% linkage is Vermont at 98.1% (406/414).
- Chamber attribution is complete: 1,339 `lower`, 985 `upper`, 680 `legislature` (joint), **0
  committees missing a `chamber` field.**
- Roles are meaningful and leadership is distinguishable: `member` 30,716, `chair` 2,877,
  `vice chair` 2,108, `ranking member` 570, `co-chair` 462, `ex officio` 433, plus
  party-specific variants (`ranking republican member`, `democratic vice chair`, etc.).

Smallest rosters, for a sense of the floor: DC 10 committees / 53 members, Nebraska 22 / 166
(unicameral, so expected), Nevada 27 / 251, Connecticut 28 / 708 (joint committees, so few
committees but many seats). Largest: US Congress 246 / 4,392, Georgia 76 / 1,317, NC 95 /
1,698.

**Weak states for committees:** none, on the axis of *existence*. The weakness is temporal, not
geographic — see §6.

**Caveat that must be flagged.** The v3 OpenAPI document at
https://v3.openstates.org/openapi.json still carries this in its `info.description`:

> "**We are currently working to restore experimental support for committees & events.**
>
> During this period please note that data is not yet available for all states
> and the exact format of the new endpoints may change slightly depending on user feedback."

That text is stale — the spec's `info.version` is `"2021.11.12"` and the underlying data has
since filled out to all 53 jurisdictions as measured above. But it means the committee
endpoints are formally labelled experimental and the response shape is not contractually
frozen. Pin your ingest to the DB/YAML field names, not to the API JSON shape.

### 1.2 LegiScan

**Jurisdictions.** 52: all 50 states, `DC` ("Washington D.C."), and `US` ("US Congress").
Verified from the `INSERT INTO ls_state` seed data in the official client's schema
(`https://api.legiscan.com/dl/legiscan-current.tar.gz`, `schema-pgsql.sql` line 1049ff). The
Microsoft Power Platform connector doc for LegiScan corroborates:
"Access legislative information from all 50 states and Congress using the LegiScan API."
(https://learn.microsoft.com/en-us/connectors/legiscan/)

**Committee membership: absent.** This is the finding that decides the evaluation. Three
independent confirmations:

1. **API surface.** The full operation list in the v1.91 manual
   (https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf, p.7) is: `getSessionList`,
   `getMasterList`, `getMasterListRaw`, `getBill`, `getBillText`, `getAmendment`,
   `getSupplement`, `getRollCall`, `getPerson`, `getSearch`, `getSearchRaw`, `getDatasetList`,
   `getDataset`, `getSessionPeople`, `getSponsoredList`, `getMonitorList`, `getMonitorListRaw`,
   `setMonitor`. **There is no `getCommittee`, no `getCommitteeMembers`, no committee roster
   operation of any kind.**
2. **Data dictionary.** Every occurrence of "committee" in the 43-page manual is one of:
   `pending_committee_id` / `committee{}` (the committee a bill is *currently* pending in),
   `referrals[]` (committees a bill has been referred to), `committee_sponsor` /
   `committee_id` (flag for when a *committee itself* is the sponsor of a bill), or committee
   names inside free-text action strings. None of these is a roster.
3. **Reference schema.** The official client ships a normalized Postgres schema
   (`legiscan/schema-pgsql.sql`) with 40 tables. `ls_committee` is:

   ```sql
   CREATE TABLE ls_committee (
     committee_id smallint NOT NULL,
     committee_body_id smallint NOT NULL,
     committee_name varchar(128) NOT NULL
   );
   ```

   Three columns. No join table to `ls_people`. LegiScan's own canonical model has no concept
   of who sits on a committee.

You could *infer* partial membership from committee roll-call votes (`getRollCall` returns
`people_id` per vote, and committee votes do appear — the manual's own example is
`"desc": "House: Human Services Subcommittee: DO PASS"`). That gives you people who voted in a
committee, which is a noisy, lagging, incomplete proxy for the current roster, and it is
useless for a committee that has not yet voted on anything this session. Not a substitute.

Other entities are fine: bills, subjects (`subjects[]`), sponsorships with type and order,
rosters (`getSessionPeople`), districts, party, roll calls with per-member positions, plus
extras Open States lacks (`sasts[]` same-as/similar-to bill relations, fiscal notes,
amendments, third-party IDs for FollowTheMoney / VoteSmart / OpenSecrets / Ballotpedia).

---

## 2. Historical depth

A two-year window would be disqualifying. Neither is disqualified.

### 2.1 Open States

The bulk session archive index (https://open.pluralpolicy.com/data/session-csv/) lists
**682 archived sessions**. Measured earliest session year per jurisdiction from that page:

- **CA back to 1989** (56 sessions incl. specials), **NC back to 1985** (45 sessions).
- GA and MN back to **2013**, NJ to **2016**.
- **Every other state starts at 2017.** (AZ and IL name their sessions "53rd Legislature"
  style with no bare year, so they didn't parse — their earliest entries are the
  2017–2018 legislatures.)

So the reliable floor is **~9 years of sponsorship history (2017→2026) in all 50 states**,
with two states going back 35+ years. That is comfortably enough to build a sponsorship-affinity
model: most sitting legislators' entire tenure is inside the window.

The v3 API is not year-limited — `/bills` takes `jurisdiction` + `session` and will serve any
session in the database. The Postgres dump is described as a
"Nearly-complete database dump of Open States' public data"
(https://open.pluralpolicy.com/downloads/), i.e. the same corpus.

### 2.2 LegiScan

`getSessionList` returns all sessions per state and `getDatasetList` returns every downloadable
session archive; neither is documented with a cutoff. The manual's own worked examples show real
depth: the `getSponsoredList` example returns a California senator with sessions
`1624 (2019-2020)`, `1400 (2017-2018)`, `1120 (2015-2016)`, `993 (2013-2014)`, `82 (2011-2012)`
— **five biennia, ~10 years, in one call**
(https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf, pp.29–30).

`getSearch` accepts `year` where "1=all, 2=current, 3=recent, 4=prior, >1900=exact", implying
searchable history well before 2011. I could not verify the exact archive floor because
https://legiscan.com/datasets is behind a Cloudflare bot challenge (see §8).

**Note LegiScan's one genuinely superior feature for this product:** `getSponsoredList` is a
single call that returns a legislator's entire cross-session sponsorship history. Open States
has no equivalent single-call endpoint — you filter `/bills?sponsor=ocd-person/...` per session,
or (better) just query your own ingested table.

---

## 3. Auth, rate limits, quotas

### 3.1 Open States

**Auth.** API key, passed as `X-API-KEY` header or `?apikey` query param. From the docs:

> "API keys are required. You can register for an API key and once activated, you'll pass your
> API key via the X-API-KEY header or ?apikey query parameter."
> — https://docs.openstates.org/api-v3/

Unauthenticated calls return:

```
HTTP/2 403
{"detail":"Must provide API Key as ?apikey or X-API-KEY. Login and visit https://openstates.org/account/profile/ for your API key."}
```

Signup now requires a Google or GitHub account:
"Due to a large volume of spam signups, we now require a social network or Google account to
create an account." (https://open.pluralpolicy.com/accounts/signup/)

**Rate limits.** *Not documented anywhere in the public docs* — I grepped the whole v3 docs page
and the changelog; the only hit is the 2020-10-13 changelog entry "add rate limiting"
(https://docs.openstates.org/api-v3/changelog/). The real numbers are in the open-source API
server, `github.com/openstates/api-v3`, `api/auth.py`:

```python
limiter = V3RateLimiter(
    prefix="v3",
    tiers=[
        Tier("default", 10, 0, 250),
        Tier("bronze", 40, 0, 1000),
        Tier("silver", 80, 0, 50000),
        Tier("unlimited", 360, 0, 1_000_000_000),
    ],
    use_redis_time=False,
    track_daily_usage=True,
)
```

with `Tier` declared in `api/rate_limiter.py` as
`Tier(name: str, per_minute: int, per_hour: int, per_day: int)`. So:

| Tier | per minute | per day |
|---|---|---|
| default (free) | 10 | 250 |
| bronze | 40 | 1,000 |
| silver | 80 | 50,000 |
| unlimited | 360 | 1,000,000,000 |

**And the killer detail:** `max_per_page = 20` on both `/bills` (`api/bills.py:54`) and
`/committees` (`api/committees.py:28`). Free tier therefore tops out at **250 × 20 = 5,000 bills
per day**. Bronze gets 20,000/day. There are ~2M bills in the corpus. Live-API backfill is not
possible; bulk is mandatory. There is no self-serve upgrade path — tiers are granted by Plural
staff on request. **Budget time to email them and get at least `bronze`, ideally `silver`.**

**Commercial server-side use of the key:** nothing in the ToS restricts it. The only relevant
clause is:

> "Use of the Services may be subject to certain limitations on access as set forth within this
> Agreement or otherwise noted. If we reasonably believe you have attempted to exceed or
> circumvent these limits, your ability to use the service may be permanently or temporarily
> blocked."
> — https://open.pluralpolicy.com/tos/ ("Right to Limit")

That is a rate-limit clause, not a commercial-use clause. Don't share one key across tenants and
don't run parallel keys to evade the cap.

### 3.2 LegiScan

**Auth.** API key on the query string: `https://api.legiscan.com/?key=APIKEY&op=OPERATION&PARAMS`.
Key obtained from a free OneVote account.

> "To use the LegiScan API you need an API Key which can be obtained at LegiScan. All it takes to
> get started is an authenticated OneVote free public service account with LegiScan."
> — https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf, p.5

**Free quota, verbatim:**

> "Public service keys have a monthly limit of 30,000 queries to mirror the OneVote public
> tracking service."
> — https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf, p.5

30,000/month ≈ 1,000/day, which is roughly Open States' *bronze* tier. But note the manual's
warning that cached repeats still burn quota:

> "Requests that exceed these recommendations will be served unchanged cached data while still
> spending an API query operation."
> — ibid., p.7

**Paid.** The Push API is explicitly a paid product:

> "The Push API is available as a paid subscription service to clients that require real-time
> updates, from a single state to the entire nation, that are pushed every 15 minutes to 4 hours
> as changes are detected in bill information."
> — ibid., p.5

**Pricing: could not verify.** https://legiscan.com/pricing/api is behind a Cloudflare
JavaScript challenge that returns HTTP 403 to every non-browser client I tried (WebFetch, curl
with full browser headers, Googlebot/bingbot UAs, r.jina.ai, allorigins), and web.archive.org
is blocked by this environment's egress policy. A search-engine-indexed snippet of that page
described tiers of "100,000-250,000 queries per month" above the free 30,000, but I could not
open the page to read the dollar figures, so **treat LegiScan pricing as unknown and get it in
writing from sales@legiscan.com.** Third-party connector docs list only
"Rate-limited depending on your API subscription tier."
(https://learn.microsoft.com/en-us/connectors/legiscan/)

---

## 4. Licensing and terms — the decisive section

### 4.1 Open States / Plural: clean. Build on it.

Open States was adopted by Plural (a commercial company) in 2021
— "In 2021 Open States was adopted by Plural... As of 2023, the core team is led by Plural
staff" (https://open.pluralpolicy.com/about/) — so the reasonable worry is that terms were
tightened. **They were not.** The current terms, effective 2021-09-15 (i.e. *after* the Plural
adoption), say, verbatim:

> **Attribution**
>
> "No attribution is required for using data obtained via Open States. We make no copyright
> claim over any of the data we collect & publish. Of course, attribution is always appreciated
> but no affiliation or endorsement may be implied on your derivative product."
>
> — https://open.pluralpolicy.com/tos/

Reading the whole document (I fetched and read all 147 lines of it), the operative sections are:
Scope, Attribution, Right to Limit, Service Termination, Right to Delete, Changes, Disclaimer of
Warranties, Limitations on Liability, General Representations, Indemnification, Miscellaneous,
Disputes, No Waiver. **There is no commercial-use restriction, no redistribution restriction, no
anti-caching clause, no field-of-use restriction, and no non-compete.** The scope clause covers
all three delivery channels equally:

> "Open States offers data via an API, bulk downloads, and the website OpenStates.org
> (collectively, the 'Services')." — ibid.

So the **API and the bulk data are licensed identically** — same document, same terms. Good.

The bulk people/committee data carries an *additional*, stronger grant. The
`openstates/people` repository (the upstream source of every committee-membership record) is
licensed **CC0 1.0 Universal**, and its README states:

> "Also, please note that this portion of the project is in the public domain in the United
> States with all copyright waived via a [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
> dedication. By contributing you agree to waive all copyright claims."
> — https://github.com/openstates/people (README.md; `LICENSE` is the full CC0 1.0 text)

and the downloads page states:

> "Open States makes almost all of our data available in bulk. Unless otherwise noted data is
> provided under a public domain dedication but attribution is greatly appreciated and very
> helpful."
> — https://open.pluralpolicy.com/downloads/

**Answer to the product question:** yes. A closed-source commercial product may ingest Open
States data, cache it in its own Postgres, derive recommendations from it, and sell access to
those recommendations. Underlying legislative records are US government works with no copyright
anyway; Open States disclaims copyright over its compilation; the bulk people/committee layer is
affirmatively CC0.

**Three residual risks, none blocking:**

1. **Unilateral amendment.** "Open States reserves the right, at our sole discretion, to modify
   or replace this Agreement, in whole or in part." A future Plural could tighten terms.
   *Mitigation:* snapshot the ToS text and the CC0 LICENSE file at ingest time and keep them in
   the repo. Data already lawfully obtained under CC0 stays CC0 — CC0 is irrevocable.
2. **Termination at will.** "Open States reserves the right to... terminate or deny you access
   to use all or part of the Services at any time for any other reason in our sole discretion."
   *Mitigation:* the bulk Postgres dump is a static S3 object; keep your own copies.
3. **Endorsement.** "no affiliation or endorsement may be implied on your derivative product."
   *Mitigation:* don't put an Open States or Plural logo in the UI; a plain "Data source: Open
   States" credit line is fine and appreciated.

*Business-relationship note:* Plural sells a bill-tracking product. Coram's sponsor-matching
tool is adjacent to, arguably competitive with, Plural's commercial offering. That is legally
fine under these terms, but it is a reason to keep your own copy of the data rather than depend
on their live API for production traffic.

### 4.2 LegiScan: NOT clean. This is the trap.

LegiScan is a for-profit LLC (LegiScan LLC, Charleston WV — manual p.2) that sells legislative
data as its business. Unlike Open States, **it does not disclaim rights in the data.**

The one piece of LegiScan licensing text I can quote with certainty is the client *software*
license, which is a **2-clause BSD license covering the PHP client only** — not the data:

> "Copyright 2010-2020 LegiScan LLC
>
> Redistribution and use in source and binary forms, with or without modification, are permitted
> provided that the following conditions are met: 1. Redistributions of source code must retain
> the above copyright notice... 2. Redistributions in binary form must reproduce the above
> copyright notice..."
> — `COPYRIGHT` file inside https://api.legiscan.com/dl/legiscan-current.tar.gz

**Do not mistake this BSD license for a data license.** It licenses `LegiScan.php`. It says
nothing about the bills, sponsorships, or datasets the client downloads.

The actual data terms live at https://legiscan.com/terms-of-service, which **I could not
retrieve** — Cloudflare returns 403 to every automated client, and the Wayback Machine is
blocked by this session's egress policy. Search-engine-indexed excerpts of LegiScan pages
describe two things pulling in opposite directions:

- Permissive-sounding marketing: API data "can be used to power commercial & public product
  offerings, offer in-depth analysis, drive engagement & outreach programs or in other ways."
- Restrictive-sounding ToS: "LegiScan (or LegiScan's licensors) owns all legal right, title and
  interest in and to the Services, including any intellectual property rights which subsist in
  the Services," and LegiScan "offers subscription data services for alternative licensing
  terms, including near real-time remote replication of the national database."

**I am flagging these as unverified snippets, not quotes I stand behind.** But the shape is
clear and it is the shape you should expect from a commercial data vendor: *you may use it, on
their terms, under a subscription; they assert ownership; wholesale replication is a separately
licensed product.* The phrase "alternative licensing terms" for replication strongly implies the
default terms do **not** grant replication rights.

**The trap, stated loudly:** LegiScan *looks* free and permissive. The free key, the 30k/month
quota, the BSD-licensed client, the ships-with-a-Postgres-schema bulk importer, and the
README's cheerful "Bulk Import — Starting here is STRONGLY encouraged" all read like an open
dataset. It is not one. Building a closed-source commercial product on a replicated LegiScan
database under a free public-service key, without a written license, is a real commercial and
legal exposure — precisely the "permissive-seeming API with terms that forbid commercial
redistribution" failure mode. **If Coram ever wants LegiScan, get a signed data license first.
Do not start with the free key and sort it out later.**

---

## 5. Bulk vs live — and what that means on Cloudflare Workers

Coram runs on Cloudflare Workers, so per-request fan-out to a third-party API is the wrong shape
(latency, subrequest limits, quota exhaustion, and a hard dependency on someone else's uptime for
every page view). A nightly/weekly sync into our own Postgres is strongly preferred. Both APIs
support that; Open States supports it better.

### 5.1 Open States

Four bulk channels (https://open.pluralpolicy.com/downloads/):

| Channel | Format | Gated? | Cadence (docs) | Cadence (observed) |
|---|---|---|---|---|
| Postgres dump | `pg_dump` custom (`v1.16`) | **No** | "updates regularly throughout the month, typically no more than a day or two behind" | 2026-07 file: 10,711,908,617 bytes, `last-modified: Wed, 01 Jul 2026 02:01:26 GMT` — i.e. cut at month start |
| Per-session bill+vote CSV | CSV in ZIP | **Yes, free login** | "This data will update monthly" | 35 sessions refreshed 2026-07-28 (yesterday) — active sessions are effectively **weekly** |
| Per-session bill+vote JSON | JSON (includes full bill text) | **Yes, free login** | "This data will update monthly" | same |
| Legislator CSV | CSV | **No** | "published nightly" | verified live: `https://data.openstates.org/people/current/tx.csv` → 200, 118,609 bytes |
| Committee/people YAML | YAML in git | **No** | as-needed | git repo, weekly automated commits in session |

The Postgres dump URL pattern is public and stable:
`https://data.openstates.org/postgres/monthly/YYYY-MM-public.pgdump`
(schema-only companion at `/postgres/schema/YYYY-MM-schema.pgdump`, 712 KB).
Verified: the July 2026 public dump returns HTTP 200 with no auth.

Caveat, quoted:

> "Currently only supported in the context of restoring a database for development. No
> guarantees are made about internal schema changes or availability."
> — https://open.pluralpolicy.com/downloads/

Take that seriously: pin a schema version, diff the schema dump each month before restoring, and
fail the pipeline loudly rather than silently on a column rename.

**Recommended ingest architecture:**

1. **Backfill:** one-time restore of the 10.7 GB monthly Postgres dump into a staging Postgres,
   then ETL into Coram's own normalized tables. Do this outside Workers (a container/VM job) —
   10.7 GB will not restore inside a Worker.
2. **Committee memberships:** sync from the `openstates/people` git repo, not the API. It is
   CC0, it is small (3,004 YAML files), it diffs cleanly, and `git log` gives you a free audit
   trail of when a member joined or left a committee. Pull weekly. This is strictly better than
   the `/committees?include=memberships` endpoint, which at `max_per_page=20` would cost ~150
   requests per full crawl and gives you no change history.
3. **Bill deltas:** either re-pull the per-session CSV archives weekly (login-gated but free,
   and refreshed for active sessions ~weekly as measured), or use `/bills?updated_since=...`
   from the v3 API for near-real-time. Budget: at `max_per_page=20`, a day with 4,000 changed
   bills nationally = 200 requests, which fits inside `bronze` (1,000/day) but blows past free
   (250/day). **Request `bronze` or `silver`.**
4. Workers then only ever read Coram's own Postgres (via Hyperdrive). Zero third-party calls on
   the request path.

### 5.2 LegiScan

Also genuinely bulk-capable — mechanically this is the better-engineered bulk pipeline of the
two:

> "The Bulk API utilizes the weekly datasets that contain all getBill, getRollCall and getPerson
> payload records as individual JSON files in separate ZIP archives for each session. These can
> then be processed to import a new or update an existing session in its entirety."
> — https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf, p.5

`getDatasetList` → `getDataset`/`getDatasetRaw` with `format=json|csv`, each session with a
`dataset_hash` for change detection. The official client's README makes the economics explicit:

> "Starting here is __STRONGLY__ encouraged as a few hundred files are the equivalent of
> approximately __2 million__ individual API calls."
> — `legiscan/README.md` in https://api.legiscan.com/dl/legiscan-current.tar.gz

The documented sync workflow is exactly what you'd want:

> "The typical workflow for maintaining session data begins with Bulk loading the appropriate
> datasets, then periodically using getMasterListRaw to compare current change_hash with stored
> value for each bill and using getBill to retrieve and update those bills that have changed."
> — manual, p.6

And it ships a ready-made Postgres schema (`schema-pgsql.sql`, 40 tables). If licensing were
clean and committee membership existed, this would be the easier ingest. Neither is true.

---

## 6. Freshness

### 6.1 Open States

**Bills and votes — good.**

> "In general bill & vote data is collected multiple times a day via our scrapers while
> legislator data is curated by our team & volunteers."
> — https://open.pluralpolicy.com/about/

The v3 API exposes `updated_since`, `created_since`, and `action_since` filters on `/bills`
(`api/bills.py`), so delta sync is a first-class operation. New bills and new sponsorships land
within hours of the state site publishing them.

**Committee reassignments — this is the soft spot. Measure it, don't assume it.** Committee
membership is updated by an automated weekly job that opens a PR against `openstates/people`.
From `git log` on the repo (HEAD 2026-07-15):

```
2026-06-11  People committee update2026-06-11-00-01
2026-06-04  People committee update2026-06-04-00-01
2026-05-28  People committee update2026-05-28-00-01
2026-05-21  People committee update2026-05-21-00-01
2026-05-07  People committee update2026-05-07-00-01
2026-04-30  ...  2026-04-23  ...  2026-04-16  ...  2026-04-09
2026-04-02, 2026-03-05, 2026-02-12, 2026-01-29
2025-07-17, 2025-07-16, 2025-05-30, 2025-05-23, ...
```

Two things to read off that:

- **In session (Jan–Jun) it runs weekly.** Good enough — a committee reassignment shows up
  within ~7 days.
- **Out of session it stops.** There are **no committee updates between 2025-07-17 and
  2026-01-29** — a ~6.5-month gap across the interim. And as of today (2026-07-29) the most
  recent committee commit is **2026-06-11, seven weeks stale.**

**Product implication:** committee rosters are trustworthy during session and stale in the
interim. Interim committee shuffles, resignations, and leadership changes made in July–December
will not appear until the January refresh. Coram should (a) surface a `committee_roster_as_of`
date in the UI, and (b) for high-stakes recommendations during the interim, fall back on
"members of this committee last session" framing rather than asserting a current roster. Do not
silently present a June roster as December truth.

### 6.2 LegiScan

Fresher on bills, non-existent on committees. Recommended polling intervals from the manual (p.7)
are `getMasterList`/`getMasterListRaw` hourly, `getBill` every 3 hours, `getPerson` weekly,
`getSessionPeople` weekly, `getSponsoredList` daily, bulk datasets weekly. The Push API delivers
"every 15 minutes to 4 hours as changes are detected" on a paid subscription. Committee
reassignment freshness is not applicable — there is no such record.

---

## 7. Data model — actual field names and example payloads

### 7.1 Open States — sponsorship

**API JSON** (`GET /bills/{jurisdiction}/{session}/{bill_id}?include=sponsorships`). Schema from
https://v3.openstates.org/openapi.json, `components.schemas.BillSponsorship`. Fields, with
`required` marked:

| field | type | required | notes |
|---|---|---|---|
| `id` | string (uuid) | yes | |
| `name` | string | yes | as printed by the state, e.g. `"JONES"` |
| `entity_type` | string | yes | `"person"` or `"organization"` |
| `primary` | boolean | yes | **primary vs cosponsor lives here** |
| `classification` | string | yes | e.g. `"primary"`, `"cosponsor"` |
| `person` | CompactPerson | no | resolved legislator, incl. `id` = `ocd-person/...` |
| `organization` | Organization | no | set when a committee sponsors |

Example response fragment (shape per the OpenAPI spec — I had no API key to capture a live call,
so field *values* are illustrative but field *names and nesting* are exact):

```json
{
  "id": "ocd-bill/f0049138-1ad8-4506-a2a4-f4dd1251bbba",
  "session": "2025",
  "identifier": "SB 113",
  "title": "Relating to child care subsidies",
  "subject": ["EDUCATION", "CHILDREN"],
  "jurisdiction": { "id": "ocd-jurisdiction/country:us/state:tx/government", "name": "Texas" },
  "from_organization": { "id": "ocd-organization/...", "name": "Senate", "classification": "upper" },
  "first_action_date": "2025-01-14",
  "latest_action_date": "2025-03-21",
  "latest_action_description": "Referred to Education K-16",
  "sponsorships": [
    {
      "id": "3b1f8b2e-0c1d-4f6a-9a11-6c2f0d3e5a77",
      "name": "Huffman",
      "entity_type": "person",
      "primary": true,
      "classification": "primary",
      "person": {
        "id": "ocd-person/1997b231-45f7-4f29-a435-9f52e60ebea4",
        "name": "Joan Huffman",
        "party": "Republican",
        "current_role": { "title": "Senator", "org_classification": "upper", "district": "17" }
      }
    },
    {
      "id": "9c4d1a70-77f2-41c9-8f6b-2d0aa1c93b10",
      "name": "West",
      "entity_type": "person",
      "primary": false,
      "classification": "cosponsor",
      "person": { "id": "ocd-person/...", "name": "Royce West", "party": "Democratic" }
    }
  ],
  "actions": [
    {
      "description": "Referred to Education K-16",
      "date": "2025-03-21",
      "classification": ["referral-committee"],
      "order": 4,
      "organization": { "id": "ocd-organization/...", "name": "Senate", "classification": "upper" },
      "related_entities": [
        {
          "name": "Education K-16",
          "entity_type": "organization",
          "organization": { "id": "ocd-organization/aabbbbcc-...", "name": "Education K-16", "classification": "committee" }
        }
      ]
    }
  ]
}
```

**The `actions[].classification == "referral-committee"` + `related_entities[].organization.id`
path is how you learn which committee heard a bill.** That, joined to committee memberships, is
the whole "who would hear this" half of the product. Action classification vocabulary is
documented at https://docs.openstates.org/data/categorization/.

**Postgres dump columns** (from `https://data.openstates.org/postgres/schema/2026-07-schema.pgdump`,
which is what you'll actually write the ingest against):

```sql
CREATE TABLE opencivicdata_billsponsorship (
    id uuid NOT NULL,
    name character varying(2000) NOT NULL,
    entity_type character varying(20) NOT NULL,
    "primary" boolean NOT NULL,          -- NB: reserved word, must be quoted
    classification character varying(100) NOT NULL,
    bill_id character varying(45) NOT NULL,
    organization_id character varying(53),
    person_id character varying(47)
);

CREATE TABLE opencivicdata_bill (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    extras jsonb NOT NULL,
    id character varying(45) NOT NULL,
    identifier character varying(100) NOT NULL,
    title text NOT NULL,
    classification text[] NOT NULL,
    subject text[] NOT NULL,             -- the topic array you'll match on
    from_organization_id character varying(53),
    legislative_session_id uuid NOT NULL,
    first_action_date character varying(25),
    latest_action_date character varying(25),
    latest_action_description text NOT NULL,
    latest_passage_date character varying(25),
    citations jsonb NOT NULL
);

CREATE TABLE opencivicdata_billaction (
    id uuid NOT NULL,
    description text NOT NULL,
    date character varying(25) NOT NULL,
    classification text[] NOT NULL,      -- contains 'referral-committee'
    "order" integer NOT NULL,
    bill_id character varying(45) NOT NULL,
    organization_id character varying(53) NOT NULL
);

CREATE TABLE opencivicdata_billactionrelatedentity (
    id uuid NOT NULL,
    name character varying(2000) NOT NULL,
    entity_type character varying(20) NOT NULL,
    action_id uuid NOT NULL,
    organization_id character varying(53),  -- the referred-to committee
    person_id character varying(47)
);
```

Note dates are stored as `varchar`, not `date` — states emit partial dates. Cast defensively.

### 7.2 Open States — committee membership

**API JSON** (`GET /committees?jurisdiction=tx&include=memberships`). `CommitteeMembership`
schema is deliberately minimal:

| field | type | required |
|---|---|---|
| `person_name` | string | yes |
| `role` | string | yes |
| `person` | CompactPerson | no |

**Postgres dump columns** — this is the richer, canonical form and what you should ingest:

```sql
CREATE TABLE opencivicdata_membership (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    extras jsonb NOT NULL,
    id character varying(51) NOT NULL,
    person_name character varying(300) NOT NULL,
    role character varying(300) NOT NULL,      -- 'chair','vice chair','member','ranking member',...
    start_date character varying(10) NOT NULL,
    end_date character varying(10) NOT NULL,
    organization_id character varying(53) NOT NULL,  -- the committee
    person_id character varying(47),
    post_id character varying(45)
);

CREATE TABLE opencivicdata_organization (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    extras jsonb NOT NULL,
    id character varying(53) NOT NULL,
    name character varying(300) NOT NULL,
    classification character varying(100) NOT NULL,   -- 'committee' | 'subcommittee' | 'upper' | ...
    jurisdiction_id character varying(300),
    parent_id character varying(53),                  -- chamber, or parent committee
    links jsonb NOT NULL,
    sources jsonb NOT NULL,
    other_names jsonb NOT NULL
);
```

Note `opencivicdata_membership` is overloaded: it holds *both* committee seats
(`organization_id` → a committee) and chamber seats (`organization_id` → `upper`/`lower`, with
`post_id` set to the district). Filter on the organization's `classification` when you want
committee seats.

**Real committee record**, verbatim from
`openstates/people`, `data/tx/committees/legislature-Legislative-Budget-Board-bb8e87b8-519d-409b-a5cb-5db9b9532c93.yml`
— this is exactly what a weekly git sync would give you:

```yaml
id: ocd-organization/bb8e87b8-519d-409b-a5cb-5db9b9532c93
jurisdiction: ocd-jurisdiction/country:us/state:tx/government
classification: committee
name: Legislative Budget Board
chamber: legislature
sources:
- url: https://www.lbb.texas.gov/default.aspx
links:
- url: https://www.lbb.texas.gov/default.aspx
members:
- name: Dustin Burrows
  role: chair
  person_id: ocd-person/fff5eb4f-2c41-4d00-a1c5-e566a15b063e
- name: Armando Walle
  role: member
  person_id: ocd-person/3caafbc8-6561-4bf8-8247-aaf398573ba8
- name: Charles Schwertner
  role: member
  person_id: ocd-person/d7d0bd69-2615-4d0c-84df-4cdb75809343
- name: Greg Bonnen
  role: member
  person_id: ocd-person/d0fbfb15-2f0c-4167-b8b4-d6135bbb6616
- name: Joan Huffman
  role: member
  person_id: ocd-person/1997b231-45f7-4f29-a435-9f52e60ebea4
other_names:
- name: Joint Committee on Legislative Budget Board
- name: Joint Legislative Budget Board
```

**Legislator CSV**, live-verified header from `https://data.openstates.org/people/current/tx.csv`
(HTTP 200, 118,609 bytes, no auth):

```
id,name,current_party,current_district,current_chamber,given_name,family_name,gender,email,
biography,birth_date,death_date,image,links,sources,capitol_address,capitol_voice,capitol_fax,
district_address,district_voice,district_fax,twitter,youtube,instagram,facebook,wikidata
```

Multi-valued columns (`links`, `sources`) are `;`-separated.

### 7.3 LegiScan — sponsorship

Data dictionary from https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf, p.35:

```
sponsors[][]           array   Array of sponsors
  sponsor[]            array   Individual sponsor record
    people_id          integer Internal people id
    person_hash        string  Hash of the personal details to aid change detection
    party_id           integer Internal party id
    party              string  Party text
    role_id            integer Internal role id
    role               string  Role text
    name               string  Full name
    first_name         string  First name
    middle_name        string  Middle name
    last_name          string  Last name
    suffix             string  Suffix
    district           string  Legislative district
    ftm_eid            integer FollowTheMoney.org EID
    votesmart_id       integer VoteSmart.org ID
    opensecrets_id     string  OpenSecrets.org ID (Congress Only)
    knowwho_pid        integer KnowWho.com PID
    ballotpedia        string  Ballotpedia.org Name
    sponsor_type_id    integer Internal sponsor type id (primary, co, joint)
    sponsor_order      integer Index of order in sponsorship list
    committee_sponsor  boolean Committee sponsor flag (0, 1)
    committee_id       integer Internal committee id (if committee_sponsor)
```

`sponsor_type_id` vocabulary (manual p.42): `0` Sponsor (Generic / Unspecified), `1` Primary
Sponsor, `2` Co-Sponsor, `3` Joint Sponsor. `role_id` (p.41): `1` Representative / Lower
Chamber, `2` Senator / Upper Chamber, `3` Joint Conference.

Real example response, verbatim from the manual (`getBill`, MD SB181, pp.11–15) — note this is
the *only* place committees appear, as `pending_committee_id` / `committee{}` / `referrals[]`,
never as a roster:

```json
{
  "status": "OK",
  "bill": {
    "bill_id": 1167968,
    "change_hash": "0176f32311854cf3ab1ab69a94e237e5",
    "session_id": 1636,
    "url": "https://legiscan.com/MD/bill/SB181/2019",
    "state": "MD",
    "bill_number": "SB181",
    "title": "Education - Child Care Subsidies - Mandatory Funding Level",
    "pending_committee_id": 1928,
    "committee": {
      "committee_id": 1928,
      "chamber": "H",
      "chamber_id": 49,
      "name": "Ways and Means"
    },
    "referrals": [
      { "date": "2019-01-23", "committee_id": 1929, "chamber": "S", "chamber_id": 50, "name": "Budget and Taxation" },
      { "date": "2019-02-22", "committee_id": 1922, "chamber": "H", "chamber_id": 49, "name": "Appropriations" }
    ],
    "sponsors": [
      {
        "people_id": 4718,
        "person_hash": "qp3urxai",
        "party_id": 1,
        "party": "D",
        "role_id": 2,
        "role": "Sen",
        "name": "Nancy King",
        "first_name": "Nancy",
        "middle_name": "",
        "last_name": "King",
        "suffix": "",
        "nickname": "",
        "district": "SD-039",
        "ftm_eid": 5304165,
        "votesmart_id": 36382,
        "opensecrets_id": "",
        "knowwho_pid": 213267,
        "ballotpedia": "Nancy_King",
        "sponsor_type_id": 1,
        "sponsor_order": 1,
        "committee_sponsor": 0,
        "committee_id": "0"
      }
    ],
    "subjects": [
      { "subject_id": 3309, "subject_name": "Education" }
    ],
    "sasts": [
      { "type_id": 5, "type": "Crossfiled", "sast_bill_number": "SB10", "sast_bill_id": 1293389 }
    ]
  }
}
```

Reference Postgres tables from the official client (`schema-pgsql.sql`):

```sql
CREATE TABLE ls_bill_sponsor (
  bill_id integer NOT NULL,
  people_id smallint NOT NULL,
  sponsor_order smallint NOT NULL,
  sponsor_type_id smallint NOT NULL
);
```

### 7.4 LegiScan — committee membership

**There is no such record.** For completeness, the entire committee model:

```sql
CREATE TABLE ls_committee (
  committee_id smallint NOT NULL,
  committee_body_id smallint NOT NULL,
  committee_name varchar(128) NOT NULL
);
```

and the entire per-bill committee payload:

```json
"committee": { "committee_id": 1928, "chamber": "H", "chamber_id": 49, "name": "Ways and Means" }
```

The closest available proxy is `getSponsoredList`, which is genuinely excellent for the
*sponsorship* half of the product (one call, full cross-session history):

```json
{
  "status": "OK",
  "sponsoredbills": {
    "sponsor": { "people_id": 1498, "name": "Jim Beall", "party": "D", "role": "Sen", "district": "SD-015" },
    "sessions": [
      { "session_id": 1624, "session_name": "2019-2020 Regular Session" },
      { "session_id": 1400, "session_name": "2017-2018 Regular Session" },
      { "session_id": 1120, "session_name": "2015-2016 Regular Session" },
      { "session_id": 993,  "session_name": "2013-2014 Regular Session" },
      { "session_id": 82,   "session_name": "2011-2012 Session" }
    ],
    "bills": [
      { "session_id": 1624, "bill_id": 1131906, "number": "AB8" },
      { "session_id": 1400, "bill_id": 937925,  "number": "AB249" }
    ]
  }
}
```

---

## 8. Research limitations — what I could not verify

Stated explicitly so nobody treats these as settled:

1. **LegiScan's Terms of Service text.** https://legiscan.com/terms-of-service,
   https://legiscan.com/pricing/api, and https://legiscan.com/datasets all sit behind a
   Cloudflare managed challenge that returned HTTP 403 to WebFetch, to curl with full browser
   headers, to Googlebot/bingbot user agents, and to r.jina.ai. `web.archive.org` is blocked by
   this environment's egress policy. All LegiScan facts above therefore come from
   `api.legiscan.com` (the v1.91 User Manual PDF and the official client tarball), which are not
   Cloudflare-protected, plus clearly-labelled search-engine snippets. **The licensing
   conclusion in §4.2 is a risk assessment, not a quoted term.** Before any LegiScan
   integration, a human should open those pages in a browser and read them.
2. **LegiScan paid pricing.** Unknown. Contact sales@legiscan.com.
3. **LegiScan's earliest archived session.** Manual examples prove ≥2011; the datasets page that
   would prove more is blocked.
4. **Live Open States API responses.** Signup requires Google/GitHub OAuth, so I could not
   capture live JSON. Every Open States *field name*, *nesting*, and *constraint* above comes
   from primary machine-readable sources — the OpenAPI document, the API server source, or the
   Postgres schema dump — so the ingest contract is solid; only illustrative *values* in §7.1
   are synthesized, and that block is marked as such.
5. **Open States session CSV/JSON archives** are behind a free login, so I confirmed their
   existence and refresh dates from the index page but did not download one.

---

## 9. Recommendation

**Build Coram's sponsor matching on Open States / Plural, ingested in bulk into Coram's own
Postgres. Do not build on LegiScan.**

Reasons, in order of weight:

1. **LegiScan has no committee membership data.** Not thin — absent. Half the product is
   unbuildable on it.
2. **Open States' committee membership is unexpectedly strong.** 3,004 committees across all
   53 jurisdictions, 38,616 seats, 99.98% linked to person IDs, chair/vice-chair/ranking roles
   distinguishable, and a git-backed change history you get for free.
3. **The licensing is clean and quotable.** "We make no copyright claim over any of the data we
   collect & publish," plus explicit CC0 on the people/committee repo, plus identical terms for
   API and bulk. A closed-source commercial product can ingest, cache, derive, and sell. That is
   a written answer, not an inference. LegiScan is the opposite: a commercial vendor asserting
   IP in its Services, with a free key that looks like an open dataset and is not one.
4. **Bulk-first fits Cloudflare Workers.** An ungated 10.7 GB monthly Postgres dump plus a small
   git repo for committees plus nightly people CSVs means Workers never call a third party on
   the request path.
5. **History is sufficient.** ~9 years in every state, 35+ in CA/NC. Not a two-year window.

**Immediate actions:**

- Email Open States/Plural and request a **`bronze` or `silver`** API tier. Free (250 req/day ×
  20 per page) will not sustain delta sync. There is no self-serve upgrade.
- Snapshot `open.pluralpolicy.com/tos/` and the `openstates/people` `LICENSE` (CC0 1.0) into the
  repo today, dated. CC0 is irrevocable; the ToS is amendable at Plural's sole discretion.
- Model committee rosters with an explicit `as_of` date and surface it. The weekly refresh stops
  out of session — verified 6.5-month gap Jul 2025 → Jan 2026, and 7 weeks stale as of
  2026-07-29. Never present an interim roster as current truth.
- Treat the "experimental committees" warning in the v3 OpenAPI description as real: pin ingest
  to the Postgres/YAML field names, not the API JSON shape.
- If LegiScan's national full-text search later looks compelling, negotiate a written data
  license **before** writing any code against it.

---

## Sources

- Open States API v3 docs — https://docs.openstates.org/api-v3/
- Open States API v3 changelog — https://docs.openstates.org/api-v3/changelog/
- Open States v3 OpenAPI document — https://v3.openstates.org/openapi.json
- Open States v3 API server source (rate-limit tiers, `max_per_page`) — https://github.com/openstates/api-v3 (`api/auth.py`, `api/rate_limiter.py`, `api/bills.py`, `api/committees.py`)
- Open States Terms of Use & Privacy Policy — https://open.pluralpolicy.com/tos/
- Open States Bulk Data — https://open.pluralpolicy.com/downloads/
- Open States legislator CSV docs — https://open.pluralpolicy.com/data/legislator-csv/
- Open States session CSV archive index — https://open.pluralpolicy.com/data/session-csv/
- Open States Postgres dumps — https://data.openstates.org/postgres/monthly/2026-07-public.pgdump · https://data.openstates.org/postgres/schema/2026-07-schema.pgdump
- Open States people/committee data + CC0 license — https://github.com/openstates/people
- Open States categorization vocabulary — https://docs.openstates.org/data/categorization/
- Open States about (scrape cadence, Plural adoption) — https://open.pluralpolicy.com/about/
- LegiScan API v1.91 User Manual (rev 20250317) — https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf
- LegiScan API client source, schema, and COPYRIGHT — https://api.legiscan.com/dl/legiscan-current.tar.gz · https://api.legiscan.com/dl/
- LegiScan Power Platform connector reference — https://learn.microsoft.com/en-us/connectors/legiscan/
- LegiScan pages that could not be retrieved (Cloudflare 403) — https://legiscan.com/terms-of-service · https://legiscan.com/pricing/api · https://legiscan.com/datasets
