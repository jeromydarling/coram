# Official state legislature APIs and bulk feeds

**Checked: 2026-07-29.** Every URL in the "verified" table below was fetched live from
this environment on that date and returned the format claimed. Anything I could not
load is in the *Unverified* section, not the table — an endpoint that 404s is worse
than no answer.

Method: direct HTTP probes (`curl`) plus documentation fetches. Where committee
membership is marked **yes**, I retrieved an actual roster response, not a doc claim.

---

## 1. States with a verified official machine-readable feed

12 states. Sorted best-to-worst for Coram's purposes (verification against an aggregator).

| State | Endpoint / download | Format | Auth | Committee membership | Terms / restrictions |
|---|---|---|---|---|---|
| **Oregon** | `https://api.oregonlegislature.gov/odata/odataservice.svc/` | OData v3 — Atom XML, or JSON with `$format=json` | **None** | **Yes** — `CommitteeMembers` collection (`CommitteeCode`, `LegislatorCode`, `Title` = Chair/Vice-Chair/Member) | None published on the service. No rate limit encountered. |
| **Arizona** | `https://apps.azleg.gov/api/Bill/`, `/api/Committee/`, `/api/Legislator/`, `/api/Session/` | JSON | **None** | **Yes** — `/api/Committee/?sessionId=N&includeMembers=true` returns full roster with `IsChair` / `IsViceChair` | No published terms; API is undocumented (powers the AZLEG site). |
| **New York** | `https://legislation.nysenate.gov/api/3/` | JSON (XML on request) | **Yes** — free API key, `?key=`; returns 401 without | **Yes** — `/api/3/committees/{session}/{chamber}` with roles `CHAIR_PERSON`, `VICE_CHAIR`, `MEMBER` | Docs state no commercial restriction; free key, service is open source. Terms not otherwise published. |
| **Washington** | `https://wslwebservices.leg.wa.gov/` — 9 `.asmx` services (Committee, CommitteeAction, CommitteeMeeting, Legislation, Sponsor, Amendment, LegislativeDocument, RcwCiteAffected, SessionLaw) | SOAP-documented, but **plain HTTP GET works** and returns XML: `.../CommitteeService.asmx/GetCommittees?biennium=2025-26` | **None** | **Yes** — `GetCommitteeMembers` / `GetActiveCommitteeMembers` (requires a `committeeName` param; no bulk "all rosters" call) | Documented as "free of charge to all interested parties", 24/7. No commercial restriction stated. |
| **Ohio** | `https://search-prod.lis.state.oh.us/api/v2/` → `/general_assembly_136/legislation`, `/committees`, `/committees/{id}/members/` | JSON | **None** | **Yes** — `/committees/{lpid}/members/` returns member records with `role` | **Undocumented.** No developer page found (`/api/` itself 404s); this is the internal LSC/SOLAR API. No published terms — treat as unsupported and liable to change. |
| **Massachusetts** | `https://malegislature.gov/api/GeneralCourts/{n}/Documents`, `/Committees`, `/LegislativeMembers` | JSON | **None** | **Yes, via the member side** — member detail has a `Committees` array. Committee detail gives only `SenateChairperson` / `HouseChairperson`, so join from members to build rosters. | Undocumented public API (no swagger at `/api`). No published terms. |
| **Virginia** | `https://lis.virginia.gov/api/...` (40+ endpoints); portal `https://lis.virginia.gov/developers`; key signup `https://lis.virginia.gov/apiregistration` | JSON REST | **Yes** — free API key registration | **Yes** — sessions, members, committees, legislation, minutes, calendars | **Hard restriction: 2025 session onward only.** The General Assembly has not authorized pre-2025 data via the API; older data must come from `legacylis.virginia.gov` CSV downloads. |
| **California** | `https://downloads.leginfo.legislature.ca.gov/` — `pubinfo_YYYY.zip` (biennium), `pubinfo_<Day>.zip` (weekly), `pubinfo_daily_<Day>.zip` (daily) | Bulk ZIP of Oracle-export `.dat` (pipe/backtick-delimited) + `.lob` blobs for text | **None** | **No.** Verified table list: `BILL_TBL`, `BILL_HISTORY_TBL`, `BILL_VERSION_TBL`, `BILL_VERSION_AUTHORS_TBL`, `BILL_SUMMARY_VOTE_TBL`, `BILL_DETAIL_VOTE_TBL`, `BILL_MOTION_TBL`, `BILL_ANALYSIS_TBL`, `COMMITTEE_AGENDA_TBL`, `COMMITTEE_HEARING_TBL`, `DAILY_FILE_TBL`, `LEGISLATOR_TBL`, `LOCATION_CODE_TBL`, `VETO_MESSAGE_TBL`. Committees appear only as hearing/agenda locations — **no roster table**. | No terms posted on the download index. README is a scanned PDF (`pubinfo_Readme.pdf`) with no extractable text. |
| **Alaska** | `https://www.akleg.gov/publicservice/basis/{bills,committees,members,meetings}?session=34` (send `X-Alaska-Legislature-Basis-Version: 1.4`) | XML | **None** | **No.** `committees` returns committee metadata (code, chamber, category, meeting days); `members` returns legislator detail. Found no endpoint joining the two — no roster. | No published terms. Undocumented (`/help` returns an error). |
| **Maryland** | `https://mgaleg.maryland.gov/{YYYY}RS/misc/billsmasterlist/legislation.json` (e.g. `2026RS`) | Bulk JSON, single file | **None** | **No.** Bills + full sponsor lists only. `committees.json` / `members.json` at the same path 404. | No published terms. |
| **North Carolina** | `https://www.ncleg.gov/About/Webservices` (`webservices.ncleg.gov` 302s here) | **RSS/XML feeds only** — bill history, filed bills, chaptered bills, calendars, "All Active Committees" | **None** | **No.** Active-committee feed lists committees, not members. | Site disclaimer applies; nothing specific to data reuse. |
| **Indiana** | `https://api.iga.in.gov/` — docs at `https://docs.api.iga.in.gov` | JSON REST | **Yes — key required.** Unauthenticated calls return `403 {"description":"Invalid API key"}` | **Could not verify** (no key). Docs advertise sessions, bills, committees, legislators. | Not verifiable without registration. |

### Practical notes on the above

- **Washington's SOAP framing is misleading.** The services are documented as SOAP, but
  every operation also answers a plain `GET` and returns clean XML. No SOAP client needed.
- **Ohio and Massachusetts are undocumented internal APIs.** They work today and they work
  well, but there is no published contract. Do not build a hard dependency; use them as
  spot-check sources.
- **California is a ~1 GB daily bulk drop**, not an API. The daily file was last modified
  the same day I checked, so freshness is genuinely daily. Ingest cost is real.
- **Virginia's pre-2025 cutoff is a licensing restriction, not a technical one.** If Coram
  needs historical VA data, the API cannot supply it.

---

## 2. Unverified — documented but could not be loaded from this environment

Listed separately on purpose. Do not treat as available.

| State | What exists on paper | Why unverified |
|---|---|---|
| **Texas** | `ftp://ftp.legis.state.tx.us` — documented in the [TLO FAQ](https://capitol.texas.gov/resources/FAQ.aspx). Directory layout `/bills/<session>/<doctype>/<format>/<billtype>/<group of 100>`. | FTP is blocked from this environment (`ftp://` returns no listing; the same host over HTTPS refuses connection). Separately: **the FAQ describes the contents as DOC / PDF / HTML documents — bill text, analyses, fiscal notes, witness lists — not structured bill metadata.** Even if reachable, this is a document mirror, not a data feed. `data.capitol.texas.gov` is a live CKAN portal but carries **election and redistricting** datasets, not legislation. |
| **Connecticut** | CGA bill search and downloads under `cga.ct.gov`. | `www.cga.ct.gov` refuses connection on every path tried. `search.cga.state.ct.us` does resolve (200) but serves an HTML search UI. Could not confirm any machine-readable output. |
| **Kansas** | KLISS API paths (`/li/api/v11/rev-1/...`) referenced publicly. | All API paths timed out; only the site root responded. |

---

## 3. States with no official machine-readable option — aggregator-only

**Confirmed by probing (feed absent, not just unfound):**

- **Florida** — `flsenate.gov` accepts `?format=xml` and `?format=csv` and **silently returns
  HTML** for both. No data or developer page anywhere on the Senate site.
  `myfloridahouse.gov` is HTML only. Aggregator is the only realistic source.
- **Illinois** — the relaunched `ilga.gov` has `/api/*` routes that return **HTML pages**,
  not JSON. Additionally **scraper-hostile**: `/Legislation` returns 403 to a non-browser
  user-agent. Committee pages are HTML only.
- **Colorado** — no `/api`, no `/rest`, no data portal for the legislature. `leg.colorado.gov`
  is a Drupal HTML bill-search. (`data.colorado.gov` is executive-branch, not legislative.)
- **Utah** — `le.utah.gov` returns **403 to non-browser user-agents** on most paths. The
  `lrgc/bill-data.html` page linked from the nav contains no downloads. Scraper-hostile.
- **Wisconsin** — `docs.legis.wisconsin.gov` has clean, stable URLs and RSS feeds, but
  `?format=json` is ignored and every document response is HTML. RSS gives notifications,
  not data.
- **Georgia** — `https://www.legis.ga.gov/api/` **returns 401**. An internal API demonstrably
  exists but is auth-walled with no public key registration found. Effectively closed.

**Probed shallowly, no endpoint found — treat as likely aggregator-only but not proven:**
Hawaii, Nebraska, New Mexico, Tennessee, Oklahoma, Missouri, Michigan, New Jersey,
Pennsylvania, Minnesota. Each responded only with HTML site roots at the paths tried.

The ~25 states not probed at all (per the "no deep 50-state coverage" scope) should be
assumed aggregator-only until checked.

---

## 4. Recommendation: which official sources to use as a verification check

Coram should build against the aggregator and add a thin **verifier** that re-reads a
single fact from the official source when a number is load-bearing. Ranked by
cost-to-integrate vs. value:

**Tier 1 — wire these up. Cheap, no auth, complete.**

1. **Oregon** — OData with `$filter`/`$select` means you can fetch exactly one measure or
   one committee roster in a single call. Best single-fact verifier in the country.
2. **Arizona** — one call returns every committee with its full roster and chair flags.
   The cleanest committee-membership ground truth available.
3. **Ohio** — clean JSON, per-committee member endpoint with roles, no key. Caveat: it is
   undocumented, so wrap it and expect breakage.

**Tier 2 — worth it, with friction.**

4. **New York** — the richest official dataset (bills, committees with roles, agendas,
   calendars, transcripts, laws), and near-real-time. Costs one free key.
5. **Washington** — authoritative and unauthenticated; committee-membership calls are
   per-committee so a full sync is chatty, but it is ideal for spot checks.
6. **Massachusetts** — good for member and sponsorship verification. Committee rosters
   require the member-side join.
7. **Virginia** — good for 2025+ only. Do not point historical checks at it.

**Tier 3 — bulk, use for reconciliation not lookups.**

8. **California** — the daily drop is authoritative and updated daily, but it is ~1 GB and
   has **no committee membership**. Use it as a nightly reconciliation job against
   aggregator bill/vote/author records, not as a live verifier.
9. **Maryland** — one JSON file per session; trivially cheap to diff nightly for bills and
   sponsors. No committees.

**Where the aggregator is likely to lag**

- **California and Maryland** publish complete bulk snapshots, so aggregator drift here is
  detectable and worth a nightly diff.
- **New York, Oregon, Washington, Arizona, Ohio** update in near-real time. During active
  session these are the states where an aggregator's crawl interval is most likely to be
  behind, and where a direct read is cheapest.
- **Florida, Illinois, Utah, Georgia, Colorado, Wisconsin** are the states where you have
  **no recourse** — if the aggregator is stale or wrong, there is no cheap official check.
  Two of them (Illinois, Utah) actively block non-browser clients. Treat aggregator data
  for these states as unverifiable and surface that uncertainty in the product.
- **Texas** is the largest state with no confirmed structured feed. Its FTP mirror is
  documents, not data. Assume aggregator-only until someone verifies the FTP from an
  unrestricted network.
