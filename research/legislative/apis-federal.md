# Federal US legislative data APIs — evaluation for sponsor matching

Research date: 2026-07-29. All quotes verbatim; all endpoints probed live (see "Verification log" at the bottom).

Product question this is evaluated against: *given a draft bill on some subject, surface (a) which members sit on the committee that would hear it, and (b) which members have previously sponsored something similar.*

---

## Recommendation (read this first)

**Build the nightly sync against a three-source stack. No single source covers the feature.**

| Need | Source | Why |
|---|---|---|
| Bills, sponsors, cosponsors, policy area, legislative subjects, committee **referrals** | **GovInfo BILLSTATUS bulk XML** (per-Congress ZIPs), backfill once; then delta | Free, no key, no rate limit, one 30 MB ZIP per chamber-Congress instead of ~10k API calls. Refreshed every 4 hours. |
| Daily delta ("what changed since yesterday") + member biographical detail | **api.congress.gov v3** (`fromDateTime`/`toDateTime` on list endpoints, `/member`) | 5,000 req/hr is plenty for deltas; avoids re-downloading 30 MB ZIPs. |
| **Committee and subcommittee membership**, member ID crosswalk, committee jurisdiction prose | **unitedstates/congress-legislators** (`committee-membership-current.json`, `committees-current.json`, `legislators-current.json`) | **The only maintained machine-readable roster.** api.congress.gov does not serve membership at all. |
| Membership freshness fallback when the above lags | **House Clerk `MemberData.xml`** + **senate.gov `committee_memberships_{CODE}.xml`** | Authoritative primary sources; the Clerk file is keyed by `bioguideID` and carries subcommittee rank and leadership title. |

**Do not build against:**
- **ProPublica Congress API — dead.** Shut down 10 July 2024. No successor, no transfer. See §6.
- **Google Civic Information `representatives` — dead.** Turned down April 2025; removed from the v2 discovery document. Only `elections` and `divisions` remain. See §7.

**Committee membership, definitively:** api.congress.gov **does not** expose committee rosters. Its OpenAPI spec has 108 paths and none of them returns members of a committee; `GET /v3/committee/house/hsag00/members` returns `{"error": "Unknown resource: committee/house/hsag00/members"}`. GovInfo BILLSTATUS does not carry rosters either. Rosters must come from `unitedstates/congress-legislators` (CC0), which scrapes House.gov and Senate.gov. This is the single external dependency that is *not* a government API, and it is the load-bearing one for half of your feature.

**Committee jurisdiction:** there is a partial machine-readable source — `committees-current.yaml` carries a free-text `jurisdiction` field for **42 of 49** full committees (and **0 of 181** subcommittees) — but it is prose, not a mapping from subject to committee. **Build the mapping from historical referral data, and use the prose only as an explanation string.** Measured on real data: policy-area → committee gives **61.5 % top-1 / 83.3 % top-3**. Details and the benchmark in §8.

**Blocker:** none technical. The one operational risk is that `congress-legislators` committee membership is updated by maintainer-run scrapers, not a cron — the published files were last built **2026-07-15**, two weeks before this research. Budget for a staleness monitor and a direct-scrape fallback (§9).

---

## 1. api.congress.gov (Library of Congress) — v3

Docs: <https://github.com/LibraryOfCongress/api.congress.gov> · OpenAPI: <https://raw.githubusercontent.com/LibraryOfCongress/api.congress.gov/main/Documentation/openapi.json> · Signup: <https://api.congress.gov/sign-up/>

### 1.1 Coverage

| Thing you need | Available? | Endpoint |
|---|---|---|
| Bills | Yes | `/v3/bill/{congress}/{billType}/{billNumber}` |
| Policy area (single controlled term) | Yes | on bill detail as `policyArea.name`, and `/subjects` |
| Legislative subjects (CRS detailed terms) | Yes | `/v3/bill/{c}/{t}/{n}/subjects` → `subjects.legislativeSubjects[]` |
| Sponsor | Yes | bill detail `sponsors[]` |
| Cosponsors | Yes | `/v3/bill/{c}/{t}/{n}/cosponsors` |
| Committee **referrals** for a bill (incl. subcommittee) | Yes | `/v3/bill/{c}/{t}/{n}/committees` |
| Committee list / detail / subcommittee tree | Yes | `/v3/committee/{chamber}/{committeeCode}` |
| Member roster with party, state, district | Yes | `/v3/member/congress/{congress}`, `/v3/member/{bioguideId}` |
| Member's sponsored / cosponsored legislation | Yes | `/v3/member/{bioguideId}/sponsored-legislation`, `/cosponsored-legislation` |
| **Committee membership (who sits on a committee)** | **NO** | — |
| **A member's committee assignments** | **NO** | — |

The 108 paths in `Documentation/openapi.json` include exactly these under `/committee`:

```
/committee
/committee/{chamber}
/committee/{congress}
/committee/{congress}/{chamber}
/committee/{chamber}/{committeeCode}
/committee/{congress}/{chamber}/{committeeCode}
/committee/{chamber}/{committeeCode}/bills
/committee/{chamber}/{committeeCode}/reports
/committee/{chamber}/{committeeCode}/nominations
/committee/{chamber}/{committeeCode}/house-communication
/committee/{chamber}/{committeeCode}/senate-communication
```

No `/members`. Probed live:

```
$ curl 'https://api.congress.gov/v3/committee/house/hsag00/members?api_key=…&format=json'
{ "error": "Unknown resource: committee/house/hsag00/members" }
```

The member detail response likewise omits assignments. The
[MemberEndpoint documentation](https://raw.githubusercontent.com/LibraryOfCongress/api.congress.gov/main/Documentation/MemberEndpoint.md)
lists `bioguideId`, `party`, `state`, `district`, `terms`, `depiction`,
`sponsoredLegislation`, `cosponsoredLegislation` — and no committee field.
The [ChangeLog](https://github.com/LibraryOfCongress/api.congress.gov/blob/main/ChangeLog.md)
runs to August 2026 and contains no entry adding membership; the closest are
"October 2023: Adjusted 118th Congress committee `isCurrent` values" and
"March 2024: Began populating additional committee metadata fields."

**Answer: committee rosters must come from `unitedstates/congress-legislators`, or be scraped from clerk.house.gov and senate.gov directly.**

### 1.2 Historical depth

- `/v3/congress` enumerates back to the **1st Congress (1789)**; the 4th Congress record is present at offset 115.
- **Bills exist from the 82nd Congress (1951)**, but pre-93rd records are skeletal. Probed `82/hr/2204`: it has `title`, `actions`, `laws`, `textVersions` — and **no `sponsors`, no `policyArea`, no `committees`, no `cosponsors`**.
- **93rd Congress (1973) onward is the usable floor.** `93/hr/8410/subjects` returns a populated `policyArea` ("Economics and Public Finance") and `legislativeSubjects`. This matches Congress.gov's own stated start year for legislation.
- Cosponsorship *dates* and the "original cosponsor" flag are only present from the **97th Congress (1981)**.
- Members go back to the full Biographical Directory; `/v3/member/congress/93` returns members with `terms` spanning the 1960s–80s.

Canonical reference is <https://www.congress.gov/help/coverage-dates> — note it sits behind a Cloudflare JS challenge and cannot be fetched programmatically (HTTP 403 to curl, WebFetch and archive.org proxies alike). The figures above were established empirically against the live API instead.

### 1.3 Auth and rate limits

Key signup: <https://api.congress.gov/sign-up/> — a JS form that provisions an api.data.gov key. Pass it as `?api_key=` or the `X-Api-Key` header.

> "The rate limit is set to 5,000 requests per hour."
> — <https://github.com/LibraryOfCongress/api.congress.gov#rate-limit>

This is an override of the api.data.gov platform default:

> "Limits are placed on the number of API requests you may make using your API key. Rate limits may vary by service, but the defaults are: **Hourly Limit: 1,000 requests per hour** … Exceeding these limits will lead to your API key being temporarily blocked from making further requests. The block will automatically be lifted by waiting an hour."
> — <https://api.data.gov/docs/developer-manual/>

The hourly counter is a rolling window, and there is no daily cap:

> "The hourly counters for your API key reset on a rolling basis."

Exceeded limits return HTTP 429. Current usage is readable from `X-RateLimit-Limit` / `X-RateLimit-Remaining` on every response (confirmed present on api.congress.gov responses).

`DEMO_KEY` — usable for prototyping only:

> "Hourly Limit: 30 requests per IP address per hour / Daily Limit: 50 requests per IP address per day"

(In practice api.congress.gov returns `x-ratelimit-limit: 10` for `DEMO_KEY`.)

Higher limits:

> "If you're building an application that needs higher rate limits, please reach out to the agency responsible for the API you would like higher rate limits for."

**Commercial server-side use:** permitted. Nothing in the api.congress.gov README, the api.data.gov developer manual, or the signup flow restricts commercial use, redistribution, or server-side use. The only stated obligations are the rate limit and key hygiene — "Should be kept private and should not be shared" — i.e. one key per deployment, held server-side, not embedded in a client bundle. Only two policies are referenced by the README, both privacy rather than licensing:

> "1. API keys and user registration follow the data.gov privacy policy. … 2. API content follows the Library of Congress privacy policy."

### 1.4 Licensing

Content is US federal government work. `17 U.S.C. § 105`: "Copyright protection under this title is not available for any work of the United States Government." No attribution requirement, no share-alike, no commercial restriction. CRS bill summaries and CRS-assigned subject terms are CRS work product and are equally public domain (CRS is a legislative-branch agency). Caveat below in §5.4 about non-federal material embedded in federal publications.

### 1.5 Data model — real responses

Bill detail, `GET /v3/bill/118/hr/3684` (trimmed):

```json
{
  "bill": {
    "congress": 118,
    "type": "HR",
    "number": "3684",
    "title": "Douglas Mike Day Psychedelic Therapy to Save Lives Act of 2023",
    "introducedDate": "2023-05-25",
    "originChamber": "House",
    "policyArea": { "name": "Armed Forces and National Security" },
    "sponsors": [
      {
        "bioguideId": "C001120",
        "fullName": "Rep. Crenshaw, Dan [R-TX-2]",
        "firstName": "Dan", "lastName": "Crenshaw",
        "party": "R", "state": "TX", "district": 2,
        "isByRequest": "N",
        "url": "https://api.congress.gov/v3/member/C001120?format=json"
      }
    ],
    "cosponsors": { "count": 15, "countIncludingWithdrawnCosponsors": 15, "url": "…/cosponsors?format=json" },
    "committees": { "count": 1, "url": "…/committees?format=json" },
    "subjects":   { "count": 1, "url": "…/subjects?format=json" },
    "latestAction": { "actionDate": "2023-05-25", "text": "Referred to the House Committee on Armed Services." },
    "updateDate": "2025-06-06T14:17:56Z"
  }
}
```

Cosponsors, `GET /v3/bill/118/hr/3684/cosponsors`:

```json
{
  "cosponsors": [
    {
      "bioguideId": "L000603",
      "fullName": "Rep. Luttrell, Morgan [R-TX-8]",
      "firstName": "Morgan", "lastName": "Luttrell",
      "party": "R", "state": "TX", "district": 8,
      "sponsorshipDate": "2023-05-25",
      "isOriginalCosponsor": true
    }
  ],
  "pagination": { "count": 15, "countIncludingWithdrawnCosponsors": 15, "next": "…?offset=2&limit=2" }
}
```

Sponsorship fields to model: `bioguideId` (the join key everywhere), `sponsorshipDate`, `isOriginalCosponsor`, `sponsorshipWithdrawnDate` (present only when withdrawn), `isByRequest` on sponsors.

Committee referral, `GET /v3/bill/118/hr/3684/committees`:

```json
{
  "committees": [
    {
      "systemCode": "hsas00",
      "name": "Armed Services Committee",
      "chamber": "House",
      "type": "Standing",
      "activities": [ { "name": "Referred To", "date": "2023-05-25T13:02:00Z" } ],
      "url": "https://api.congress.gov/v3/committee/house/hsas00?format=json"
    }
  ]
}
```

Committee items may also carry a `subcommittees[]` container with its own `systemCode`/`name`/`activities`. `activities[].name` values seen in the wild: `Referred To`, `Markup By`, `Reported By`, `Discharged from`, `Hearings By`. **Filter on `Referred To` when deriving jurisdiction** — the other verbs indicate the committee acted, not that it received the bill.

Subjects, `GET /v3/bill/118/hr/82/subjects`:

```json
{
  "subjects": {
    "policyArea": { "name": "Social Welfare", "updateDate": "2023-01-17T15:03:21Z" },
    "legislativeSubjects": [
      { "name": "Government employee pay, benefits, personnel management", "updateDate": "2023-02-08T21:00:52Z" },
      { "name": "Social security and elderly assistance", "updateDate": "2023-02-08T21:00:52Z" }
    ]
  }
}
```

Committee detail, `GET /v3/committee/house/hsag00` — note what is and is not there:

```json
{
  "committee": {
    "systemCode": "hsag00",
    "committeeWebsiteUrl": "https://agriculture.house.gov/",
    "isCurrent": true,
    "history": [
      { "officialName": "Committee on Agriculture",
        "libraryOfCongressName": "Agriculture",
        "committeeTypeCode": "Standing",
        "startDate": "1820-05-03T04:56:00Z",
        "establishingAuthority": "16 House Journal 479",
        "locLinkedDataId": "n81093140", "naraId": "10677551",
        "superintendentDocumentNumber": "Y 4.AG 8/1:" }
    ],
    "subcommittees": [ { "systemCode": "hsag08", "name": "Wheat, Soybeans, and Feed Grains Subcommittee", "url": "…" } ],
    "bills":   { "count": 17790, "url": "…" },
    "reports": { "count": 142,   "url": "…" },
    "communications": { "count": 936, "url": "…" }
  }
}
```

Rich provenance metadata, subcommittee tree, bill counts — **and not a single member**.

---

## 2. GovInfo (GPO) — bulk data and API

Bulk repository: <https://www.govinfo.gov/bulkdata> · JSON index: `https://www.govinfo.gov/bulkdata/json/{COLLECTION}` · API: <https://api.govinfo.gov/docs> · README: <https://github.com/usgpo/api>

### 2.1 Coverage

Relevant collections (confirmed live from the JSON index):

| Collection | Contents | Congresses present |
|---|---|---|
| **BILLSTATUS** | The whole legislative metadata record: sponsors, cosponsors, committees + subcommittees, actions, `policyArea`, `subjects`, titles, related bills, laws | **108–119** (2003–present) |
| **BILLS** | Bill *text* in XML | 113–119 (+ `uslm`) |
| **BILLSUM** | CRS bill summaries | — |
| CDIR | Congressional Directory (does contain committee rosters, but published as periodic snapshots — too stale for a live product) | 119th present |

BILLSTATUS is the same underlying data as api.congress.gov's bill endpoints — the LoC README notes "Prior versions were used by the Government Publishing Office (GPO) for its Bulk Data Repository."

Per the [usgpo/bill-status README](https://github.com/usgpo/bill-status), BILLSTATUS was published "at the direction of the U.S. House of Representatives Appropriations Committee, in support of the Legislative Branch Bulk Data Task Force," and is updated **every 4 hours for the current Congress, daily for prior Congresses**.

**BILLSTATUS does not contain committee membership either.** It has committee *referrals*, not rosters.

### 2.2 Historical depth

BILLSTATUS: 108th Congress (2003) forward — shallower than api.congress.gov's 93rd (1973). If you want the full 1973-onward sponsorship corpus you must page api.congress.gov for the 93rd–107th, or use the community `unitedstates/congress` scrapers. For sponsor matching, 108th forward (23 years, ~250k bills) is almost certainly enough.

### 2.3 Auth and rate limits

- **Bulk data (`www.govinfo.gov/bulkdata/…`) requires no API key at all.** Plain HTTPS GET. Confirmed: `HEAD https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119-hr.zip` → `HTTP/2 200`, `content-type: application/zip`, `content-length: 29951916`. There is a JSON directory index at `/bulkdata/json/…` and an RSS feed at `https://www.govinfo.gov/rss/billstatus-batch.xml`.
- **The API** does need a key from <https://www.govinfo.gov/api-signup>. Per <https://github.com/usgpo/api>:
  > "36,000 requests per hour (Primary Rate limit)" / "1,200 requests per minute" / "40 requests per second"

  Seven times api.congress.gov's ceiling. Endpoints: `/collections`, `/published`, `/packages`, `/granules`, `/related`, `/search`.

Commercial server-side use: permitted; no restriction is stated anywhere in the GovInfo API README, the signup, or the bulk data repository.

### 2.4 Licensing

> "Copyright protection under this title is not available for any work of the United States Government" (17 U.S.C. § 105)
> — <https://www.govinfo.gov/about/policies>

> "Public documents can generally be reprinted without legal restriction. However, Government publications may contain copyrighted material which was used with permission."

Two caveats GPO states explicitly, neither of which affects BILLSTATUS metadata:
- when reprinting material used by permission, "customary credit should be given to the Government department or agency which prepared the material";
- purchased images on GPO sites "are not in the public domain."

### 2.5 Data model — real BILLSTATUS XML

`https://www.govinfo.gov/bulkdata/BILLSTATUS/118/hr/BILLSTATUS-118hr3684.xml` (13 KB):

```xml
<sponsors>
  <item>
    <bioguideId>C001120</bioguideId>
    <fullName>Rep. Crenshaw, Dan [R-TX-2]</fullName>
    <firstName>Dan</firstName><lastName>Crenshaw</lastName>
    <party>R</party><state>TX</state><district>2</district>
    <isByRequest>N</isByRequest>
  </item>
</sponsors>

<cosponsors>
  <item>
    <bioguideId>L000603</bioguideId>
    <fullName>Rep. Luttrell, Morgan [R-TX-8]</fullName>
    <party>R</party><state>TX</state><district>8</district>
    <sponsorshipDate>2023-05-25</sponsorshipDate>
    <isOriginalCosponsor>True</isOriginalCosponsor>
  </item>
</cosponsors>

<committees>
  <item>
    <systemCode>hsas00</systemCode>
    <name>Armed Services Committee</name>
    <chamber>House</chamber><type>Standing</type>
    <activities><item><name>Referred To</name><date>2023-05-25T13:02:00Z</date></item></activities>
  </item>
</committees>

<policyArea><name>Armed Forces and National Security</name></policyArea>
```

Subcommittee referrals nest inside the committee item — from `BILLSTATUS-118hr5401.xml`:

```xml
<item>
  <systemCode>hsii00</systemCode>
  <name>Natural Resources Committee</name>
  <chamber>House</chamber><type>Standing</type>
  <subcommittees>
    <item>
      <systemCode>hsii10</systemCode>
      <name>Federal Lands Subcommittee</name>
      <activities>
        <item><name>Hearings By (subcommittee)</name><date>2024-07-09T18:32:13Z</date></item>
        <item><name>Referred to</name><date>2024-07-08T18:31:51Z</date></item>
      </activities>
    </item>
  </subcommittees>
  <activities>
    <item><name>Reported By</name><date>2024-12-10T17:20:23Z</date></item>
    <item><name>Referred To</name><date>2023-09-12T16:04:45Z</date></item>
  </activities>
</item>
```

`systemCode` here is identical to api.congress.gov's — the two are safely interchangeable as the committee join key. Note the case inconsistency (`Referred To` at committee level, `Referred to` at subcommittee level); normalise case when parsing.

---

## 3. unitedstates/congress-legislators

Repo: <https://github.com/unitedstates/congress-legislators> · Files: `https://unitedstates.github.io/congress-legislators/{name}.{yaml|json|csv}`

**This is where committee membership comes from.** It is not a government API — it is a community project that scrapes House.gov and Senate.gov and merges hand-maintained ID crosswalks.

### 3.1 Coverage

| File | Formats | Contents |
|---|---|---|
| `legislators-current` | YAML/JSON/CSV | 537 currently-serving members, full term history with state/district/party |
| `legislators-historical` | YAML/JSON/CSV | all former members |
| `committees-current` | YAML/JSON | 49 current committees, 181 subcommittees, **plus a `jurisdiction` prose field** |
| **`committee-membership-current`** | **YAML/JSON/CSV** | **230 committee/subcommittee rosters** keyed by THOMAS ID |
| `committees-historical` | YAML/JSON | committees from the 93rd Congress (1973) on |
| `legislators-social-media`, `legislators-district-offices`, `executive` | | not needed here |

Verified live: `committee-membership-current.json` has **230 keys**; `HSAG` (House Agriculture) has **53** members; subcommittee keys are parent + subcommittee id (`SSAF13`, `HSAG03`, …).

### 3.2 Historical depth

`committee-membership-current` is **current only — a snapshot with no history**. There is no per-Congress membership archive anywhere in the ecosystem. If you want "who sat on Ways and Means in the 117th," you must snapshot this file yourself on a schedule and version it in your own Postgres. **Start snapshotting on day one** — this is irrecoverable if you don't.

`committees-historical` covers 93rd (1973) onward but is committee *identity*, not membership, and is explicitly partial: "Only committees/subcommittees that have had bills referred to them are included."

### 3.3 Auth and rate limits

None. Static files on GitHub Pages. `committee-membership-current.json` is 480 KB, `legislators-current.json` 1.5 MB. Fetch with `If-Modified-Since`.

### 3.4 Licensing

> "The project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](http://creativecommons.org/publicdomain/zero/1.0/).
>
> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest."
> — <https://github.com/unitedstates/congress-legislators#public-domain>

**This is the one source in the stack that is not automatically public domain by operation of 17 U.S.C. § 105** — it is community-produced work, released under CC0 by an explicit dedication rather than by statute. CC0 permits commercial use with no attribution requirement, so the practical result is the same. But note the dependency chain: some fields (e.g. `jurisdiction_source` pointing at Wikipedia, `wikipedia`/`wikidata` IDs) derive from third-party sources; the CC0 dedication covers the project's own compilation. For a compliance-sensitive deployment, prefer the House Clerk and Senate XML for rosters, which *are* § 105 works.

### 3.5 Data model

`committee-membership-current.json` — the roster:

```json
{
  "HSAG": [
    { "name": "Glenn Thompson", "party": "majority", "rank": 1, "title": "Chair",          "bioguide": "T000467" },
    { "name": "Angie Craig",    "party": "minority", "rank": 1, "title": "Ranking Member", "bioguide": "C001119" },
    { "name": "Frank D. Lucas", "party": "majority", "rank": 2,                            "bioguide": "L000491" }
  ]
}
```

Field semantics from the README:
- `name` — "for reference only"; do not join on it
- **`bioguide`** — the join key to your bills table's `sponsors[].bioguideId`
- `party` — `"majority"` / `"minority"`, **not** D/R; get D/R from `legislators-current`
- `rank` — seniority within party; **`rank: 1` is the chair (majority) or ranking member (minority)**
- `title` — `Chair`, `Ranking Member`, `Ex Officio`, etc. Present only when there is one.
- `chamber` — joint committees only

`committees-current.json` — the committee, with jurisdiction:

```json
{
  "type": "house",
  "name": "House Committee on Agriculture",
  "thomas_id": "HSAG",
  "house_committee_id": "AG",
  "url": "https://agriculture.house.gov/",
  "minority_url": "https://republicans-agriculture.house.gov",
  "address": "1301 LHOB; Washington, DC 20515-6001",
  "phone": "(202) 225-2171",
  "jurisdiction": "The House Committee on Agriculture has legislative jurisdiction over agriculture, food, rural development, and forestry.",
  "subcommittees": [
    { "name": "Forestry and Horticulture", "thomas_id": "15", "address": "1301 LHOB; Washington, DC 20515", "phone": "(202) 225-2171" }
  ]
}
```

`legislators-current.json` — the member and the ID crosswalk:

```json
{
  "id": {
    "bioguide": "T000467", "thomas": "01952", "govtrack": 412317,
    "opensecrets": "N00029736", "votesmart": 24046, "fec": ["H8PA05071"],
    "icpsr": 20946, "wikidata": "Q1531120", "wikipedia": "Glenn Thompson (politician)",
    "ballotpedia": "Glenn Thompson (Pennsylvania)", "house_history": 23213
  },
  "name": { "first": "Glenn", "last": "Thompson", "official_full": "Glenn Thompson" },
  "bio":  { "birthday": "1959-07-27", "gender": "M" },
  "terms": [
    { "type": "rep", "start": "2009-01-06", "end": "2011-01-03",
      "state": "PA", "district": 5, "party": "Republican",
      "url": "http://thompson.house.gov", "office": "124 Cannon House Office Building" }
  ]
}
```

`terms[]` is the source of truth for district and party over time — party switches and redistricting show up here and nowhere else in the stack.

### 3.6 ⚠ The THOMAS-ID ↔ systemCode join

**This is the join you will get wrong.** Bills carry `systemCode` (`hsag00`, `hsii10`); rosters are keyed by `thomas_id` (`HSAG`, `HSII10`). They are the same identifier in different skins:

```
systemCode "hsag00"  →  thomas_id "HSAG"          (strip leading chamber letter, uppercase, drop trailing "00")
systemCode "hsii10"  →  thomas_id "HSII" + "10"   (subcommittee → parent thomas_id + 2-digit suffix)
```

`h`/`s`/`j` prefix ↔ house/senate/joint. Build this crosswalk as a materialised table with an assertion that every `systemCode` appearing in referral data resolves; alert on misses rather than silently dropping.

---

## 4. Where committee rosters come from officially (fallbacks)

If `congress-legislators` goes stale — and it will, transiently, after a committee reshuffle — go to the primary sources it scrapes.

### House — `https://clerk.house.gov/xml/lists/MemberData.xml`

Confirmed live, 556 KB, HTTP 200, no key. Contains a `<committees>` block defining every committee and subcommittee, and per-member `<committee-assignments>` **keyed by `bioguideID`, with rank and leadership title**:

```xml
<committee-assignments>
  <committee comcode="II00" rank="22"/>
  <committee comcode="PW00" rank="25"/>
  <committee comcode="SY00" rank="20"/>
  <subcommittee subcomcode="II06" rank="13" leadership="Vice Chair"/>
  <subcommittee subcomcode="II15" rank="5"/>
  <subcommittee subcomcode="PW05" rank="13"/>
</committee-assignments>
```

```xml
<committees>
  <committee type="standing" comcode="AG00" com-room="1301" com-building-code="LHOB" com-phone="225-2171"
             com-header-text="The chairman and ranking minority member are ex officio members of all subcommittees.">
    <committee-fullname>Committee on Agriculture</committee-fullname>
    <ratio><majority>29</majority><minority>25</minority></ratio>
    <subcommittee subcomcode="AG03" …><subcommittee-fullname>Nutrition and Foreign Agriculture</subcommittee-fullname>
      <ratio><majority>11</majority><minority>8</minority></ratio></subcommittee>
  </committee>
</committees>
```

Note this uses a **third** committee code system (`AG00`, `II06`) — the House Clerk's `house_committee_id`, which `committees-current.json` also carries as `house_committee_id: "AG"`. Use `committees-current` as the Rosetta stone between `systemCode`, `thomas_id`, and `house_committee_id`.

This file is strictly better than `congress-legislators` for the House: it is authoritative, keyed by bioguide, and carries per-subcommittee rank and leadership.

### Senate — `https://www.senate.gov/general/committee_membership/committee_memberships_{CODE}.xml`

One file per committee, e.g. `…_SSAF.xml` (12.8 KB, HTTP 200, no key):

```xml
<committee_membership>
  <committees>
    <majority_party>R</majority_party>
    <committee_name>Committee on Agriculture, Nutrition, and Forestry</committee_name>
    <committee_code>SSAF00</committee_code>
    <members>
      <member><name><first>John</first><last>Boozman</last></name>
        <state>AR</state><party>R</party><position>Chairman</position></member>
      <member><name><first>Amy</first><last>Klobuchar</last></name>
        <state>MN</state><party>D</party><position>Ranking</position></member>
    </members>
  </committees>
</committee_membership>
```

**Caveat: no bioguide IDs.** You must resolve `(first, last, state, party)` → bioguide against `legislators-current`. That is exactly the fuzzy match `congress-legislators` already does for you, which is the argument for using it as the primary and this only as a staleness check.

---

## 5. Bulk vs live: what to actually run on Cloudflare Workers

### 5.1 The shape of the problem

A Worker is a short-lived, CPU-metered, memory-limited isolate. A 30 MB ZIP containing ~10,000 XML files is a poor fit for streaming-parse inside a single request. Concretely, measured: `BILLSTATUS-119-hr.zip` is 29,951,916 bytes / 9,970 files; the 118th equivalent is 35,522,726 bytes / 10,564 files.

### 5.2 Recommended split

**One-time backfill — bulk, run outside Workers.** Download the BILLSTATUS ZIPs for the Congresses you want (108–119 × 8 bill types ≈ 96 ZIPs, a few GB), parse them on a normal machine or a CI job, and `COPY` into Postgres. Do not try to backfill through the API: at 5,000 req/hr and ~4 requests per bill (detail + cosponsors + subjects + committees), a single Congress is ~40,000 bills-worth of calls and takes days.

**Nightly incremental — live API, runs fine in a Worker.** Use a Cron Trigger on api.congress.gov's date-bounded list endpoints:

```
GET /v3/bill?fromDateTime=<last_run>&toDateTime=<now>&sort=updateDate+asc&limit=250
```

Then fan out to `/cosponsors`, `/subjects`, `/committees` only for bills whose `updateDate` moved. Typical daily churn is low hundreds of bills → low thousands of requests, comfortably inside 5,000/hr and inside a single Worker invocation budget if you checkpoint offsets in KV or a Durable Object. Use `updateDateIncludingText` if you also track text versions; use `updateDate` otherwise, so a text-only republish doesn't force a metadata re-fetch.

**Nightly rosters — bulk, trivially Worker-sized.** `committee-membership-current.json` (480 KB) + `committees-current.json` (75 KB) + `legislators-current.json` (1.5 MB) = ~2 MB of JSON. Fetch with `If-Modified-Since`; on change, diff against the current snapshot, write a new dated version, and only touch Postgres rows that actually changed. This is the piece that must be snapshot-versioned (§3.2).

**Weekly reconciliation — bulk.** Re-pull the current Congress's BILLSTATUS ZIP outside Workers and diff against Postgres to catch anything the delta feed missed (retroactive `updateDate` edits do happen). Belt and braces.

### 5.3 Why not use the GovInfo API for the delta

You could — 36,000 req/hr is generous, and `/published` is a clean date-bounded feed. But it returns package granules rather than the parsed bill record, so you end up fetching BILLSTATUS XML per bill anyway, and you're back to XML parsing in a Worker. api.congress.gov gives you the same data as JSON with server-side date filtering. **Use GovInfo bulk for backfill and reconciliation; use api.congress.gov for the daily delta.** Keep a GovInfo API key anyway — it's your escape hatch if the LoC API has an outage, and its ceiling is 7× higher.

### 5.4 Licensing summary

| Source | Status | Basis |
|---|---|---|
| api.congress.gov | Public domain | 17 U.S.C. § 105 |
| GovInfo bulk + API | Public domain | 17 U.S.C. § 105, restated at govinfo.gov/about/policies |
| clerk.house.gov, senate.gov XML | Public domain | 17 U.S.C. § 105 |
| **unitedstates/congress-legislators** | **CC0 1.0 — dedication, not statute** | Community project, not a federal work |

The one genuine caveat, from GPO: "Government publications may contain copyrighted material which was used with permission." This applies to *documents* (a hearing transcript reproducing a copyrighted chart), not to BILLSTATUS metadata. Bill text and legislative metadata are clean.

---

## 6. ProPublica Congress API — DEAD. Definitively.

**Status: shut down 10 July 2024. Not transferred. No successor.**

The datastore URL now 301-redirects to <https://projects.propublica.org/represent/>, which reads:

> "Represent and the Congress API are no longer available. Thank you to everybody who has used these resources since their launch in 2016."

The API docs at <https://projects.propublica.org/api-docs/congress-api/> remain online but are explicitly marked as historical reference only.

**On the "transferred" recollection — that is real but it points backwards, not forwards.** The lineage is:

1. Sunlight Foundation ran the **Sunlight Congress API**.
2. Sunlight Labs wound down in 2016; **ProPublica took over five Sunlight projects**, including the Congress API (<https://www.propublica.org/nerds/sunlight-labs-takeover-update>). The Sunlight API was sunset 1 October 2017 and its users migrated to ProPublica's.
3. ProPublica ran it 2016–2024, then retired it outright.

So the transfer happened *into* ProPublica in 2016. Nothing was transferred *out* in 2024 — the service simply ended. Anyone whose mental model is "ProPublica is the easy Congress API" should be redirected to api.congress.gov, which now covers everything ProPublica did **except committee membership** (which ProPublica did serve, via `/committees/{chamber}/{committee}` — this is precisely the capability gap that makes `congress-legislators` mandatory today).

Related and worth knowing: **GovTrack also ended its bulk data and API** (<https://congressionaldata.org/ending-govtracks-bulk-data-and-api/>). The "just use a third-party Congress API" era is over; the official sources plus `congress-legislators` are what remains.

---

## 7. Google Civic Information API — representatives endpoint DEAD

**Status: `representatives` turned down April 2025 and removed from the API surface. `elections` and `divisions` survive.**

Announcement, <https://groups.google.com/g/google-civicinfo-api/c/9fwFn-dhktA> (posted 19 April 2024): the Representatives API would be turned down in April 2025 because "there are alternate providers who are able to serve authoritative representation data directly to developers." Google noted the underlying data originated from **the Governance Project**.

Confirmed removed, not merely deprecated — the live v2 discovery document at `https://civicinfo.googleapis.com/$discovery/rest?version=v2` now exposes only:

```
RESOURCE elections  ['voterInfoQuery', 'electionQuery']
RESOURCE divisions  ['search', 'queryDivisionByAddress']
```

No `representatives` resource. (The human-facing docs page at developers.google.com/civic-information is stale and still describes representative lookup — trust the discovery document, not the prose.)

**What replaced it:** nothing equivalent. Google added `divisions.queryDivisionByAddress`, which maps a residential address to **Open Civic Data IDs (OCD-IDs)** — `ocd-division/country:us/state:tx/cd:2` and so on — and expects you to look up representatives in someone else's dataset using that ID. The Governance Project has its own API; commercial fills like USgeocoder exist.

**For your feature this barely matters.** You need address → district only if you're doing constituent-side targeting. If you are: use `divisions.queryDivisionByAddress` (or the Census Geocoder, free and federal) to get state + CD, then join to `legislators-current.json` on `terms[].state` + `terms[].district`. Do **not** build a dependency on Google returning member data — that capability is gone.

---

## 8. Design question: committee jurisdiction

> *Is there a machine-readable source of committee jurisdictions, or must the mapping be derived from historical referral data?*

### 8.1 What exists

**Partially — and it is prose, not a mapping.** `committees-current.yaml` carries a `jurisdiction` field:

- **42 of 49** full committees have one; **41** also have a `jurisdiction_source` URL citing the committee's own website.
- **0 of 181** subcommittees have one.
- The 7 without: Commission on Security and Cooperation in Europe, Joint Economic, Joint Library, Joint Printing, Joint Taxation, House Select Committee on the CCP, House Select Subcommittee on January 6.

Example (`HSIF`, House Energy and Commerce), `jurisdiction_source: https://energycommerce.house.gov/committee-history/`:

> "The House Committee on Energy and Commerce has legislative jurisdiction on matters related to telecommunications, consumer protection, food and drug safety, public health research, environmental quality, energy policy, and interstate and foreign commerce. It oversees multiple cabinet-level Departments and independent agencies, including the Departments of Energy, Health and Human Services, Commerce, and Transportation, as well as the Environmental Protection Agency, the Federal Trade Commission, the Food and Drug Administration, and the Federal Communications Commission."

This is a paraphrase of House Rule X / Senate Rule XXV. The formal rules themselves are published only as prose in the House Rules and Manual and the Senate Manual — **there is no official structured jurisdiction table anywhere in the federal data ecosystem.** Nothing maps CRS policy areas or legislative subject terms onto committees.

More to the point: **formal jurisdiction is a bad predictor of actual referral.** Real referrals are governed by precedent, the Parliamentarian's judgement, multiple referral, and negotiated turf. "Armed Forces and National Security" bills go to Veterans' Affairs more often than to Armed Services (measured: 52.4 % vs. less). No prose statement of jurisdiction captures that.

### 8.2 The derived approach, measured

I built and benchmarked it against real BILLSTATUS data rather than guessing. Corpus: House bills from the 118th and 119th Congresses; label = the first committee with a `Referred To` activity; 70/30 random train/test split.

**Committee that hears a bill, from `policyArea` alone (118th, n=3,159 held out):**

| Model | Top-1 | Top-3 |
|---|---|---|
| `policyArea` → most-frequent referral committee | **61.5 %** | **83.3 %** |
| `policyArea` + `legislativeSubjects` (naive Bayes) | 49.4 % | 72.7 % |

(119th Congress reproduces this almost exactly: 60.9 % / 83.3 % and 52.1 % / 74.5 %.)

Full per-policy-area breakdown, 119th House, showing the shape of the problem:

| Policy area | n | Top committee | Top-1 | Top-3 |
|---|---:|---|---:|---:|
| Taxation | 778 | Ways and Means | 86.2 % | 91.4 % |
| Education | 351 | Education and Workforce | 84.6 % | 89.2 % |
| Law | 102 | Judiciary | 84.3 % | 96.1 % |
| Agriculture and Food | 414 | Agriculture | 79.0 % | 93.0 % |
| Crime and Law Enforcement | 613 | Judiciary | 79.0 % | 87.3 % |
| Transportation and Public Works | 460 | Transportation and Infrastructure | 78.0 % | 88.5 % |
| Housing and Community Development | 193 | Financial Services | 73.6 % | 83.4 % |
| Finance and Financial Sector | 376 | Financial Services | 73.4 % | 88.0 % |
| Labor and Employment | 226 | Education and Workforce | 69.9 % | 84.5 % |
| Emergency Management | 130 | Transportation and Infrastructure | 64.6 % | 76.2 % |
| Public Lands and Natural Resources | 356 | Natural Resources | 63.8 % | 84.3 % |
| Immigration | 423 | Judiciary | 63.8 % | 85.6 % |
| Native Americans | 116 | Natural Resources | 58.6 % | 75.0 % |
| Social Welfare | 97 | Ways and Means | 58.8 % | 77.3 % |
| Health | 1111 | Energy and Commerce | 56.8 % | 88.9 % |
| International Affairs | 530 | Foreign Affairs | 56.8 % | 76.6 % |
| Armed Forces and National Security | 841 | **Veterans' Affairs** | 52.4 % | 87.6 % |
| Foreign Trade and International Finance | 154 | Ways and Means | 49.4 % | 77.9 % |
| Government Operations and Politics | 763 | Oversight and Government Reform | 48.5 % | 69.2 % |
| Families | 68 | Education and Workforce | 47.1 % | 86.8 % |
| Energy | 276 | Energy and Commerce | 44.6 % | 73.2 % |
| Animals | 43 | Natural Resources | 44.2 % | 86.0 % |
| Water Resources Development | 59 | Natural Resources | 42.4 % | 88.1 % |
| Economics and Public Finance | 86 | Budget | 41.9 % | 69.8 % |
| Sports and Recreation | 32 | Education and Workforce | 40.6 % | 71.9 % |
| Civil Rights and Liberties | 71 | Judiciary | 39.4 % | 67.6 % |
| Science, Technology, Communications | 298 | Science, Space, and Technology | 36.9 % | 78.9 % |
| Congress | 108 | House Administration | 34.3 % | 61.1 % |
| Commerce | 289 | Energy and Commerce | 33.6 % | 71.3 % |
| Environmental Protection | 268 | Energy and Commerce | 33.2 % | 81.7 % |
| Arts, Culture, Religion | 25 | House Administration | 24.0 % | 60.0 % |

### 8.3 Three findings that should shape the build

**(a) Policy area is a 31-term controlled vocabulary and it is nearly universal.** 9,681 of 9,970 House bills in the 119th have a `policyArea`; only 289 lack one. Exactly one policy area per bill. This is a clean, low-cardinality categorical feature — ideal for a lookup table.

**(b) Legislative subject terms are too sparse to help.** **7,670 of 9,657** 119th House bills have *no* `legislativeSubjects` at all; even in the completed 118th, 6,424 of 10,529 have none (avg 3.2 terms when present, 1.8 in the 119th). CRS assigns detailed terms only to bills that see action, and it lags introduction by weeks. Adding them via naive Bayes made things **worse** (−12 pts top-1), because the independence assumption is badly violated and the sparse tail overfits. **Don't reach for subject terms first.** If you want to beat 61 %, the win is in bill *title and text*, not subject terms — and note that a draft bill won't have CRS terms assigned at all, so a subject-term-dependent model can't even run on your actual input.

**(c) Multiple referral is common and the UI should reflect it.** Of 10,564 118th House bills: 7,610 went to one committee, 2,163 to two, 466 to three, 156 to four, 78 to five or more. And 4,940 committee entries include a subcommittee referral. A single-committee answer is wrong about a fifth of the time by construction.

### 8.4 Recommendation

**Derive the mapping from historical referral data. Ship a ranked top-3, not a top-1. Use the curated `jurisdiction` prose as the human-readable justification, never as the ranking signal.**

Concretely:

1. **Materialise a `policy_area × chamber × committee → referral_count` table** from BILLSTATUS, filtered to `activities[].name ILIKE 'referred to'`, restricted to the last 3–4 Congresses so it tracks current turf rather than 2003 turf. Recompute nightly; it's one `GROUP BY`.
2. **Return the top 3 committees with their referral share** — "Energy and Commerce (57 % of Health bills), Ways and Means (18 %), Veterans' Affairs (14 %)". Showing the share is honest about uncertainty and is more useful to a user than a false-confident single answer. Top-3 recall is 83 %, which is a genuinely good product.
3. **Attach the `jurisdiction` string from `committees-current.json`** to each suggestion as explanatory text. It answers "why this committee?" in a sentence a non-expert can read. It is available for 42/49 committees; fall back to the committee's `url` for the other 7.
4. **Then join committee → roster** via the `systemCode` ↔ `thomas_id` crosswalk (§3.6) into `committee-membership-current`, and order members by `rank` within `party`, surfacing `title` (Chair, Ranking Member) first. That is the "who would hear it" half of the feature.
5. **Independently**, for the "who has sponsored something similar" half, rank members by their sponsorship count within the same `policyArea` (and the same `legislativeSubjects` where present), from your `sponsors`/`cosponsors` tables. Weight sponsor > original cosponsor > later cosponsor, and decay by Congress. This half needs no jurisdiction model at all.
6. **The two halves intersect and that intersection is the product.** A member who both sits on the likely committee *and* has sponsored in that policy area is the actual answer to "who should carry this bill." Score it as such rather than presenting two separate lists.
7. **Defer, but plan for:** a text classifier over bill titles + summaries to lift top-1 above 61 %. You have a perfectly labelled corpus of ~250k bills sitting in your own Postgres after the backfill. This is the natural v2 and it works on a draft bill (which has text but no CRS metadata), whereas the policy-area lookup requires you to first infer a policy area from the draft.

**Why not the prose-jurisdiction route:** it cannot be evaluated, it cannot be tuned, it produces no confidence signal, it is missing for all 181 subcommittees, and it demonstrably contradicts observed behaviour (the Armed Forces → Veterans' Affairs case). The derived table is one SQL query, is measurable against ground truth, improves automatically as referrals accumulate, and degrades gracefully.

---

## 9. Risks and mitigations

| Risk | Detail | Mitigation |
|---|---|---|
| **`congress-legislators` staleness** | Updated by maintainer-run scrapers + PRs, **not an automated cron**. Published files were last built **2026-07-15** (checked 2026-07-29 — 14 days). CI on the repo is only `pages-build-deployment`. | Monitor `Last-Modified` on the JSON; alert past ~7 days. Cross-check roster size and chair identity against clerk.house.gov `MemberData.xml` weekly. Have the direct-scrape path (§4) written before you need it. |
| **No membership history anywhere** | `committee-membership-current` is a snapshot; there is no per-Congress archive. | Snapshot and version it in Postgres from day one. Irrecoverable otherwise. |
| **Committee code triple-mapping** | `systemCode` (bills) vs `thomas_id` (rosters) vs `house_committee_id` (Clerk XML). | Materialise the crosswalk from `committees-current.json`; assert 100 % resolution and alert on misses. |
| **Senate XML has no bioguide IDs** | Name/state/party only. | Rely on `congress-legislators` as primary for the Senate; use senate.gov only as a staleness check. |
| **congress.gov docs are Cloudflare-gated** | `/help/coverage-dates`, `/about/legal` return 403 to every programmatic fetch. | Coverage established empirically here. Don't build a doc-scraping dependency on `www.congress.gov`. |
| **Pre-93rd bills are metadata-free** | 82nd–92nd have titles and actions but no sponsors, policy area, or committees. | Floor the corpus at the 93rd (1973), or the 108th (2003) if using BILLSTATUS bulk only. |
| **`legislativeSubjects` lag and sparsity** | ~63 % of 118th and ~79 % of 119th House bills have none. | Do not make subject terms load-bearing. Policy area is the reliable signal. |
| **Rate limit is per key, not per IP** | 5,000/hr shared across your whole deployment. | Single server-side key, request-count metering, back off on 429 using `X-RateLimit-Remaining`. Keep a GovInfo key (36,000/hr) as overflow. |

---

## Verification log

Everything below was executed live on 2026-07-29.

| Check | Result |
|---|---|
| `GET /v3/committee/house/hsag00/members` | `{"error": "Unknown resource: committee/house/hsag00/members"}` (404) |
| `openapi.json` path count | 108; zero membership paths |
| `GET /v3/bill/82/hr/2204` | no `sponsors`, `policyArea`, `committees`, `cosponsors` |
| `GET /v3/bill/93/hr/8410/subjects` | populated `policyArea` + `legislativeSubjects` |
| `GET /v3/congress?offset=115` | 4th Congress (1795–1797) present |
| api.congress.gov response headers | `x-ratelimit-limit`, `x-ratelimit-remaining` present |
| `HEAD .../BILLSTATUS/119/hr/BILLSTATUS-119-hr.zip` | HTTP 200, `application/zip`, 29,951,916 bytes, no key |
| `GET /bulkdata/json/BILLSTATUS` | Congresses 108–119 |
| `GET /bulkdata/json/BILLS` | Congresses 113–119 |
| `committee-membership-current.json` | 230 keys; `HSAG` → 53 members; `Last-Modified: Wed, 15 Jul 2026 13:39:17 GMT` |
| `committees-current.json` | 49 committees, 42 with `jurisdiction`, 41 with `jurisdiction_source`; 181 subcommittees, 0 with `jurisdiction` |
| `legislators-current.json` | 537 members |
| `clerk.house.gov/xml/lists/MemberData.xml` | HTTP 200, 556,140 bytes, `<committee-assignments>` keyed by `bioguideID` |
| `senate.gov/general/committee_membership/committee_memberships_SSAF.xml` | HTTP 200, 12,778 bytes, no bioguide IDs |
| `civicinfo.googleapis.com/$discovery/rest?version=v2` | resources: `elections`, `divisions` only |
| `projects.propublica.org/represent/` | "Represent and the Congress API are no longer available." |
| Jurisdiction benchmark | 118th House, 10,529 labelled bills, 70/30 split, n=3,159 held out |

### Primary sources

- api.congress.gov repo — <https://github.com/LibraryOfCongress/api.congress.gov>
- api.congress.gov OpenAPI — <https://raw.githubusercontent.com/LibraryOfCongress/api.congress.gov/main/Documentation/openapi.json>
- api.congress.gov ChangeLog — <https://github.com/LibraryOfCongress/api.congress.gov/blob/main/ChangeLog.md>
- api.data.gov developer manual — <https://api.data.gov/docs/developer-manual/>
- Congress.gov coverage dates — <https://www.congress.gov/help/coverage-dates> (Cloudflare-gated)
- GovInfo bulk data — <https://www.govinfo.gov/bulkdata>
- GovInfo API README — <https://github.com/usgpo/api>
- GovInfo BILLSTATUS README — <https://github.com/usgpo/bill-status>
- GovInfo policies — <https://www.govinfo.gov/about/policies>
- congress-legislators — <https://github.com/unitedstates/congress-legislators>
- House Clerk member data — <https://clerk.house.gov/xml/lists/MemberData.xml>
- Senate committee membership — <https://www.senate.gov/general/committee_membership/committee_memberships_SSAF.xml>
- ProPublica Represent sunset — <https://projects.propublica.org/represent/>
- ProPublica/Sunlight takeover — <https://www.propublica.org/nerds/sunlight-labs-takeover-update>
- ProPublica Congress API docs (historical) — <https://projects.propublica.org/api-docs/congress-api/>
- Google Civic representatives turndown — <https://groups.google.com/g/google-civicinfo-api/c/9fwFn-dhktA>
- Google Civic v2 discovery — <https://civicinfo.googleapis.com/$discovery/rest?version=v2>
- GovTrack ending bulk data/API — <https://congressionaldata.org/ending-govtracks-bulk-data-and-api/>
