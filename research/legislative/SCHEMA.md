# Per-state research output schema

Each state agent writes ONE file per state to `research/legislative/states/<XX>.json`
(two-letter USPS code, lowercase filename, e.g. `ca.json`).

Every factual field carries a `source` URL. A field you cannot verify from an
authoritative source is `null` with a note in `gaps` — never a guess. Numbers
that change with each election cycle (signature counts) are the most dangerous
to guess, so they are required to cite the Secretary of State or equivalent.

```jsonc
{
  "code": "CA",
  "name": "California",
  "asOf": "2026-07",              // when the agent checked

  "initiative": {
    "statute": "direct",          // "direct" | "indirect" | "none"
    "constitutional": "direct",   // "direct" | "indirect" | "none"
    "referendum": true,           // veto referendum on enacted laws
    "signatures": {
      "statuteFormula": "5% of votes cast for governor in last gubernatorial election",
      "statuteCount": 546651,     // most recent absolute number, or null
      "constitutionalFormula": "8% of votes cast for governor",
      "constitutionalCount": 874641,

      // A veto referendum overturns a law the legislature already passed. It is
      // a different mechanism from an initiative, on a different clock, and in
      // several states it is the ONLY citizen mechanism that exists — Maryland
      // and Kentucky have no initiative at all.
      //
      // These fields were added mid-research because several agents
      // independently refused to put a referendum threshold in `statuteCount`,
      // which was the right call: a group told it needs 60,157 signatures to
      // pass a law, when that number actually only lets it overturn one, has
      // been given a target for the wrong campaign.
      "referendumFormula": "3% of votes cast for governor",
      "referendumCount": 60157,

      "distribution": null,       // geographic distribution requirement, or null
      "source": "https://..."
    },
    "circulationDays": 180,
    "filingDeadline": "131 days before the election",
    "subjectLimits": [
      "single subject",
      "may not name a person to office"
    ],
    "preFilingReview": "Attorney General prepares title and summary; 30-day public review period",
    "source": "https://..."
  },

  "localOrdinance": {
    "citizenInitiative": true,    // can residents put an ordinance on a city/county ballot
    "notes": "General law cities: 10% of registered voters. Charter cities vary.",
    "source": "https://..."
  },

  "drafting": {
    "manualUrl": "https://...",   // legislative counsel / bill drafting style guide
    "manualName": "Legislative Drafting Manual",
    "requiredSections": ["title", "enacting clause", "definitions", "..."],
    "enactingClause": "The people of the State of California do enact as follows:",
    "source": "https://..."
  },

  "legislature": {
    "chambers": ["Assembly", "Senate"],
    "sessionType": "biennial, two-year session; convenes annually in January",
    "typicalConvene": "first Monday in December (organizational), January (regular)",
    "typicalAdjourn": "August 31",
    "billIntroductionDeadline": "February of the second year",
    "carryover": true,            // do bills carry over between years of a biennium
    "source": "https://..."
  },

  "data": {
    "officialApi": "https://leginfo.legislature.ca.gov/...",  // or null
    "officialApiNotes": "Nightly bulk SQL dumps, no REST API",
    "bulkDownload": "https://...",
    "openStatesCoverage": "full",   // "full" | "partial" | "none" — bills+votes+committees
    "source": "https://..."
  },

  "citizenRoute": {
    "canRequestDraft": false,     // may a member of the public ask leg counsel for a draft
    "notes": "Drafting requests accepted only from members and committees.",
    "source": "https://..."
  },

  "gaps": [
    "Could not verify the 2026 signature count; the SoS page still lists 2022 figures."
  ]
}
```

## Rules

1. **Cite everything.** Prefer, in order: the state's Secretary of State,
   Legislative Counsel / Legislative Services Agency, the legislature's own
   site, then NCSL, then Ballotpedia. Never cite a blog.
2. **Null over guess.** A wrong signature threshold costs a group an entire
   campaign cycle. `null` plus a `gaps` entry is a correct answer.
3. **Date everything.** Signature counts are recomputed after each
   gubernatorial election. Say which election a number is based on.
4. **No prose reports.** The JSON file is the deliverable.
