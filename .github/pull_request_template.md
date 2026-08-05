<!--
The template is short on purpose. A checklist long enough to be ignored is
worse than none, because a row of ticked boxes reads as evidence.

Every item below is here because getting it wrong once cost a day, or because
it is a promise made on a public page. Delete any section that genuinely does
not apply — an empty heading is noise, and a section left in with "n/a" under
it teaches the next reader to skim.
-->

## What this changes

<!-- One paragraph. What is different afterwards, not a list of files. -->

## Why

<!-- The problem. If it is a bug, what the wrong behaviour was. -->

## How it was checked

<!--
Not "tests pass" — CI says that. What did you actually drive?

Nearly every defect in this codebase to date was invisible to the unit
suite: mocked fetches do not enforce row-level security, postgres.js
encodes arrays and jsonb in ways a mock never will, and valid markup
still renders wrong. If the change touches the database, say which
statement you ran against a real one. If it touches a page, say what you
looked at.
-->

## Data

- [ ] No new column holds anything about a person that we would not want read
      aloud in a subpoena (§3).
- [ ] Any new table is registered with `retention.ts` in this same commit, and
      `npm run check:retention` passes (§3.4).
- [ ] Any new tenant-scoped table carries `tenant_id` and has RLS both `ENABLE`d
      and `FORCE`d, default-deny (§4.2).

## Promises

- [ ] Nothing here softens the bail-fund waiver, the free tier, or the burn
      switch (§10).
- [ ] No analytics, no tracker, no external JS on any route, and no second repo,
      Worker or service (§1.5, §10).
- [ ] If this adds a module, it is one of the eleven in §5. There is no twelfth.

## Secrets

- [ ] No credential, connection string or API token appears in the diff, in a
      fixture, in a comment, or in a test name. They go in as Worker secrets or
      GitHub Actions secrets and nowhere else.
