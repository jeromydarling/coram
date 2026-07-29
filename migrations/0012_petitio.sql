-- ---------------------------------------------------------------------
-- 0012 — Petitio (§5.5): advocacy, and the bill a group writes
--
-- The last of the eleven modules to get tables. §5.5's line reads "legislator
-- lookup by address, federal through municipal" and "delivery and response
-- tracking", which is exactly what a bill-drafting tool needs: this is not a
-- twelfth module, it is what Petitio was always for. A petition that succeeds
-- has to become something, and the something is a bill.
--
-- ---------------------------------------------------------------------
-- Two design decisions that are not obvious
-- ---------------------------------------------------------------------
--
-- **Sections are rows, not a blob.** A bill is a fixed sequence of parts — a
-- short title, an enacting clause, definitions, operative sections, a
-- severability clause, an effective date. Storing the draft as one text column
-- would make it a shared document, which is a thing organisers already have for
-- free. Storing the parts separately is what lets the product refuse to advance
-- a draft with no definitions section, which is the most common reason
-- legislative counsel bounces citizen language back.
--
-- **Outreach records offices, not influence.** The brief this was built from
-- asks for a graph of "which organiser has the strongest existing tie to which
-- legislative office". That artefact — a scored map of who can influence whom,
-- sitting in Postgres — is one of the most dangerous things this product could
-- hold, and §3 says nothing is stored that we would not want subpoenaed.
--
-- What is stored instead is the minimum that lets a team avoid two people
-- cold-calling the same office in the same week: which public office, what
-- happened, when, and who logged it. There is no tie-strength column, no
-- relationship score, and no free-text field about a named staffer. Lobbying
-- contact with a public official is frequently a matter of public record
-- anyway; a private assessment of a named staffer's sympathies is not, and it
-- is not ours to accumulate.
-- ---------------------------------------------------------------------

-- Which route a group is taking. Mirrors RouteKind in
-- src/shared/legislative/index.ts, and the two must stay in step — a value
-- here that the field guide cannot explain is a draft with no instructions.
CREATE TYPE coram.bill_route AS ENUM (
  'local',
  'initiative',
  'indirect-initiative',
  'referendum',
  'sponsor'
);

-- Where the effort actually stands. Deliberately the real-world stages rather
-- than a scoring ladder: the honest answer to "where are we" is the whole
-- value, and there is nothing to gamify about a bill sitting in committee.
--
-- 'adopted' is the group's own decision to make this their position — a
-- Consilium (§5.8) vote — and is separate from 'filed', which only a
-- legislator can cause. Conflating them would let a product tell a group it
-- had introduced a bill when it had only agreed to try.
CREATE TYPE coram.bill_stage AS ENUM (
  'drafting',
  'adopted',
  'seeking_sponsor',
  'filed',
  'in_committee',
  'passed',
  'failed',
  'withdrawn'
);

CREATE TYPE coram.bill_section_kind AS ENUM (
  'short_title',
  'enacting_clause',
  'findings',
  'definitions',
  'operative',
  'severability',
  'effective_date'
);

CREATE TABLE public.bills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- The working name, not the short title. A group calls it "the repairs bill"
  -- long before it has statutory language, and forcing a formal title at
  -- creation is the blank-page problem the templates exist to avoid.
  working_name text NOT NULL CHECK (length(btrim(working_name)) > 0),

  -- USPS code, validated against the compiled field guide in the application.
  -- Two characters here rather than a foreign key: the pathway data is a
  -- versioned artefact in the bundle, not a table, because it is research we
  -- publish rather than tenant data we hold.
  jurisdiction text NOT NULL CHECK (jurisdiction ~ '^[A-Z]{2}$'),
  -- Set when the route is local: the city or county whose charter governs.
  -- Free text because a municipality is not enumerable at this scale.
  locality     text,

  route        coram.bill_route NOT NULL,
  stage        coram.bill_stage NOT NULL DEFAULT 'drafting',

  -- The one-page problem statement (§ the brief's Stage 1). Held here rather
  -- than as a section because it is not part of the bill — it is the document
  -- a legislator's staff reads first, and it survives every rewrite of the
  -- language.
  problem      text,

  -- What the group wants to happen, in their own words, before it is statute.
  intent       text,

  -- Recorded when a sponsor actually files it. The bill number is the only
  -- external identifier that matters and the only real milestone in the whole
  -- process.
  filed_as     text,
  filed_at     timestamptz,

  created_by   uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- A filed bill has a number. Nothing else may.
  CONSTRAINT bills_filed_has_number CHECK (
    (stage <> 'filed' AND stage <> 'in_committee' AND stage <> 'passed')
    OR filed_as IS NOT NULL
  )
);

CREATE INDEX bills_tenant_stage ON public.bills (tenant_id, stage);

-- ---------------------------------------------------------------------

CREATE TABLE public.bill_sections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bill_id    uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,

  kind       coram.bill_section_kind NOT NULL,
  -- Operative sections are ordered and there may be many. The others are
  -- singular, enforced by the unique index below.
  position   integer NOT NULL DEFAULT 0,
  heading    text,
  body       text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One short title, one enacting clause, one severability clause, one effective
-- date, one definitions section. Many operative sections and many findings.
CREATE UNIQUE INDEX bill_sections_singular
  ON public.bill_sections (bill_id, kind)
  WHERE kind IN ('short_title', 'enacting_clause', 'definitions', 'severability', 'effective_date');

CREATE INDEX bill_sections_bill ON public.bill_sections (bill_id, kind, position);

-- ---------------------------------------------------------------------
-- Coalition support. The credibility artefact staff actually ask for.
-- ---------------------------------------------------------------------

CREATE TABLE public.bill_endorsements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bill_id     uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,

  -- An organisation, not a person. Individual supporters belong in Membra and
  -- are not published; an endorsing organisation has chosen to be named, which
  -- is the entire point of an endorsement.
  org_name    text NOT NULL CHECK (length(btrim(org_name)) > 0),
  -- Optional public contact the organisation gave for this purpose.
  org_url     text,
  -- Whether the group has said this may be listed publicly. Defaults to false:
  -- an endorsement gathered privately must not become a press release by
  -- accident.
  public      boolean NOT NULL DEFAULT false,
  note        text,

  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (bill_id, org_name)
);

-- ---------------------------------------------------------------------
-- Outreach. Read the header note before adding a column here.
-- ---------------------------------------------------------------------

CREATE TYPE coram.outreach_outcome AS ENUM (
  'requested',
  'scheduled',
  'met',
  'declined',
  'no_response',
  'committed',
  'refused'
);

CREATE TABLE public.bill_outreach (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bill_id    uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,

  -- The office, as a public identifier. An Open States ocd-person id, a federal
  -- bioguide id, or a plain office name for a city council seat that has
  -- neither. Not a person record: we hold no contact details for legislators
  -- and no notes about their staff.
  office_ref  text NOT NULL CHECK (length(btrim(office_ref)) > 0),
  office_name text NOT NULL,

  outcome     coram.outreach_outcome NOT NULL,
  occurred_on date NOT NULL,

  -- Which of our own people did this, so a team does not send three organisers
  -- to the same office in a week. This is the only personal reference in the
  -- table and it points at a membership, not a contact.
  by_member   uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  -- What was agreed or asked, factually. Deliberately not a place to record an
  -- assessment of a named staffer — see the header note. The application caps
  -- this and the retention sweep clears it.
  note        text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bill_outreach_bill ON public.bill_outreach (bill_id, occurred_on DESC);
CREATE INDEX bill_outreach_office ON public.bill_outreach (tenant_id, office_ref);

-- ---------------------------------------------------------------------
-- RLS. Default deny, then the narrowest grant that makes the module work.
-- ---------------------------------------------------------------------

ALTER TABLE public.bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.bill_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_sections     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.bill_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_endorsements FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.bill_outreach     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_outreach     FORCE  ROW LEVEL SECURITY;

-- A draft bill is the group's shared work and every member can read it. That is
-- deliberate and it is the opposite of the CRM: a bill is a political position,
-- and a position the membership cannot read is not the membership's position.
-- `legal` is excluded in line with every other non-case table.
CREATE POLICY bills_select ON public.bills FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY bills_write ON public.bills FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY bill_sections_select ON public.bill_sections FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY bill_sections_write ON public.bill_sections FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY bill_endorsements_select ON public.bill_endorsements FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY bill_endorsements_write ON public.bill_endorsements FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

-- Outreach is narrower than the bill itself. Who has approached which office is
-- operational detail for the people doing it, not a standing broadcast to the
-- whole membership — and a smaller audience is a smaller disclosure surface for
-- exactly the table the header note is about.
CREATE POLICY bill_outreach_select ON public.bill_outreach FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY bill_outreach_write ON public.bill_outreach FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE TRIGGER bills_touch BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();
CREATE TRIGGER bill_sections_touch BEFORE UPDATE ON public.bill_sections
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills             TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_sections     TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_endorsements TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_outreach     TO coram_app;
