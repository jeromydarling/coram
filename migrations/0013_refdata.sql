-- ---------------------------------------------------------------------
-- 0013 — Reference data: who holds office, and which committees they sit on
--
-- The first tables in this product that are not tenant-scoped, and the reason
-- is worth stating rather than inferring. Every other table answers "what does
-- this workspace hold". These answer "who is currently a legislator", which is
-- the same for everyone and is published by the states and by Congress.
--
-- No tenant_id, no RLS, and nothing for the nightly sweep to age out — the
-- ingest replaces these wholesale. src/worker/lib/retention.ts now carries an
-- explicit `scope: 'reference'` so that this is a declared property rather than
-- four tables that happen to be missing a column.
--
-- ---------------------------------------------------------------------
-- What is deliberately not here
-- ---------------------------------------------------------------------
--
-- Contact details. The Open States legislator CSV ships email, capitol_voice,
-- capitol_fax, district_address, district_voice, district_fax, and six social
-- handles. None of it is ingested.
--
-- That is not squeamishness, it is a promise already made: 0012_petitio.sql
-- says "we hold no contact details for legislators and no notes about their
-- staff", and the outreach route repeats it to the user on every read. A
-- reference table quietly full of direct lines would make both statements
-- false. registerTable() now refuses a reference table declaring contact-class
-- data, so this cannot be walked back by accident.
--
-- What is held is name, party, chamber, district — the roster. Anyone who needs
-- a phone number gets it from the legislature's own website, which is where it
-- is published and where it is current.
--
-- ---------------------------------------------------------------------
-- Staleness is a first-class column, not a footnote
-- ---------------------------------------------------------------------
--
-- Open States refreshes committee rosters weekly *only while a chamber is in
-- session*. The research observed a 6.5-month gap across one interim and found
-- the live data seven weeks stale on the day it was checked. A roster shown
-- without a date is a roster the reader will assume is current, and a group
-- lobbying a committee chair who left the committee in March has wasted the
-- approach that mattered most.
--
-- So ref_sync records what was fetched and when, every table carries the sync
-- it came from, and the API returns the date alongside the names.
-- ---------------------------------------------------------------------

CREATE TABLE public.ref_sync (
  -- 'openstates.people', 'openstates.committees', 'congress.legislators',
  -- 'congress.committees'. One row per source, replaced on each run.
  source        text PRIMARY KEY,
  -- When the upstream data was itself last built, where the source tells us —
  -- not when we fetched it. congress-legislators is maintainer-run rather than
  -- automated, so "we fetched it today" says nothing about its age.
  upstream_at   timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  rows_loaded   integer NOT NULL DEFAULT 0,
  -- 'ok' or 'failed'. A failed sync leaves the previous rows in place: stale
  -- data with an honest date beats an empty table.
  status        text NOT NULL CHECK (status IN ('ok', 'failed')),
  note          text
);

CREATE TABLE public.ref_legislators (
  -- ocd-person/... for states, bioguide id for Congress. This is the value the
  -- outreach log's office_ref holds, which is why both are plain text.
  id            text PRIMARY KEY,
  -- USPS code, or 'US' for Congress.
  jurisdiction  text NOT NULL,
  chamber       text,
  district      text,
  name          text NOT NULL,
  party         text,
  source        text NOT NULL REFERENCES public.ref_sync(source) ON DELETE CASCADE,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ref_legislators_jurisdiction ON public.ref_legislators (jurisdiction, chamber);

CREATE TABLE public.ref_committees (
  -- ocd-organization/... for states; the thomas_id (HSAG) for Congress.
  id            text PRIMARY KEY,
  jurisdiction  text NOT NULL,
  chamber       text,
  name          text NOT NULL,
  classification text,
  -- Set for a subcommittee. Federal subcommittees vastly outnumber committees
  -- and have no published jurisdiction text of their own.
  parent_id     text REFERENCES public.ref_committees(id) ON DELETE CASCADE,
  /*
   * Bill referrals use a different code from committee rosters: a federal bill
   * names hsag00 where the roster names HSAG and the Clerk names AG00. The
   * crosswalk is mechanical but it has to be materialised, because a join that
   * silently matches nothing produces an empty committee rather than an error.
   */
  system_code   text,
  -- Prose from the source where it exists. Explanatory, not a mapping: 42 of 49
  -- federal committees have it and none of the 181 subcommittees do, and it
  -- contradicts practice often enough that referral history is the real signal.
  jurisdiction_text text,
  source        text NOT NULL REFERENCES public.ref_sync(source) ON DELETE CASCADE,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ref_committees_jurisdiction ON public.ref_committees (jurisdiction, chamber);
CREATE INDEX ref_committees_system_code ON public.ref_committees (system_code);

CREATE TABLE public.ref_committee_members (
  committee_id  text NOT NULL REFERENCES public.ref_committees(id) ON DELETE CASCADE,
  -- Not a foreign key to ref_legislators on purpose. A committee roster and a
  -- legislator roster are built from different files that can disagree for a
  -- week after a resignation, and a constraint here would fail the whole
  -- ingest over one person. The name is carried so a row is still useful when
  -- the id does not resolve.
  person_id     text NOT NULL,
  person_name   text NOT NULL,
  -- 'chair', 'vice chair', 'ranking member', 'member'. The chair is the
  -- actionable one — the chair decides whether a bill gets a hearing at all.
  role          text NOT NULL DEFAULT 'member',
  rank          integer,
  source        text NOT NULL REFERENCES public.ref_sync(source) ON DELETE CASCADE,
  updated_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (committee_id, person_id)
);

CREATE INDEX ref_committee_members_person ON public.ref_committee_members (person_id);

-- ---------------------------------------------------------------------
-- Grants. Read-only to the request path; the ingest connects as the owner.
--
-- coram_app gets SELECT and nothing else. It has no business writing published
-- facts, and a workspace that could UPDATE a committee roster could quietly
-- change what every other workspace sees.
-- ---------------------------------------------------------------------

GRANT SELECT ON public.ref_sync              TO coram_app;
GRANT SELECT ON public.ref_legislators       TO coram_app;
GRANT SELECT ON public.ref_committees        TO coram_app;
GRANT SELECT ON public.ref_committee_members TO coram_app;

GRANT SELECT ON public.ref_sync              TO coram_cron;
GRANT SELECT ON public.ref_legislators       TO coram_cron;
GRANT SELECT ON public.ref_committees        TO coram_cron;
GRANT SELECT ON public.ref_committee_members TO coram_cron;
