-- ---------------------------------------------------------------------
-- 0017 — the watch list: bills, hearings and agendas that moved
--
-- Part of Petitio (§5.5), not a twelfth module. §5 is a closed list of eleven
-- and this is advocacy work: the thing a group needs before it can lobby a
-- committee is to know the committee is meeting. Everything here reads under
-- /app/advocacy.
--
-- ---------------------------------------------------------------------
-- What this holds, and why it is the smallest table in the product
-- ---------------------------------------------------------------------
--
-- Three kinds of row:
--
--   watch_topics   the group's own words. "eviction", "rent board", "SB 442".
--   watch_sources  where to look. A state's bill feed, or a city's agenda RSS.
--   watch_items    public documents that matched.
--
-- Not one of those is about a person. A bill number, a hearing date and a
-- council agenda are published by the government that produced them; a topic
-- is a phrase somebody typed. There is no reading history, no "seen by", no
-- per-member relevance, and no click log — because the obvious version of this
-- feature is a surveillance product pointed at your own membership, and once
-- the table exists somebody will ask for the report.
--
-- The one field that comes close is `dismissed_by`, and it is a membership id
-- on a public document so that two organizers do not both chase the same
-- hearing. It is nullable, it is never shown as a list, and the retention
-- sweep takes the whole row inside ninety days.
--
-- ---------------------------------------------------------------------
-- Ninety days, and the thing you keep is not the item
-- ---------------------------------------------------------------------
--
-- A feed is not an archive. An item that mattered becomes an event in
-- Convocare or a bill in Petitio — a row the group owns, with no expiry — and
-- the watch item that produced it is a pointer that has done its job. Keeping
-- the feed forever would build, at no benefit, a dated record of every
-- ordinance a group was interested in and when they noticed it.
--
-- So items expire at ninety days whether or not anyone converted them, and
-- `converted_kind` / `converted_id` exist only to stop the same hearing being
-- turned into three events by three people in the same week.
--
-- ---------------------------------------------------------------------
-- Relevance sorts. It never filters.
-- ---------------------------------------------------------------------
--
-- `relevance` is written by a model and `matched_terms` is written by string
-- matching, and only the second one decides whether a row exists. A monitor
-- that quietly drops a hearing because a model scored it low is worse than no
-- monitor at all: the group believes they are covered and they are not. The
-- score orders the list and nothing else, which is why it is nullable — a
-- source polled while inference is down still produces rows.
-- ---------------------------------------------------------------------

CREATE TYPE coram.watch_source_kind AS ENUM (
  -- Open States v3 /bills for one jurisdiction, filtered by updated_since.
  'bills',
  -- Any Atom or RSS feed the group names: a council agenda, a court calendar,
  -- a local paper's city desk. Fetched by the Worker, never by the browser.
  'feed'
);

CREATE TYPE coram.watch_item_state AS ENUM (
  'new',
  -- Somebody looked and decided it matters. Does not extend retention.
  'kept',
  'dismissed'
);

-- ---------------------------------------------------------------------

CREATE TABLE public.watch_topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- What the group calls it. "Evictions", "The rent board", "Bus routes".
  label      text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),

  -- The words to match on, lowercased by the application before insert. An
  -- array rather than a table because it is a short list edited as one thing,
  -- and because a topic with no terms is a topic that matches nothing, which
  -- the CHECK makes impossible.
  terms      text[] NOT NULL CHECK (
    cardinality(terms) BETWEEN 1 AND 24
    AND array_position(terms, NULL) IS NULL
  ),

  -- Off rather than deleted, so a group can stop watching the school board
  -- over the summer without losing the words they worked out.
  active     boolean NOT NULL DEFAULT true,

  created_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX watch_topics_tenant ON public.watch_topics (tenant_id, active);

-- ---------------------------------------------------------------------

CREATE TABLE public.watch_sources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  kind         coram.watch_source_kind NOT NULL,
  label        text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 120),

  -- Set for 'bills'. USPS code, same vocabulary as bills.jurisdiction.
  jurisdiction text CHECK (jurisdiction ~ '^[A-Z]{2}$'),

  -- Set for 'feed'. https only, enforced here and again in the Worker before
  -- a socket is opened — a URL the group can set is a URL the group can point
  -- at something we should not fetch.
  url          text CHECK (url IS NULL OR url ~ '^https://'),

  CONSTRAINT watch_sources_shape CHECK (
    (kind = 'bills' AND jurisdiction IS NOT NULL AND url IS NULL)
    OR (kind = 'feed' AND url IS NOT NULL AND jurisdiction IS NULL)
  ),

  active       boolean NOT NULL DEFAULT true,

  -- The last poll, and whether it worked. Shown to the user on every read for
  -- the same reason ref_sync is: a feed that has been failing for three weeks
  -- looks exactly like a quiet one, and a group that thinks they are being
  -- told about hearings and is not has been actively misled by us.
  last_polled_at timestamptz,
  last_status    text CHECK (last_status IN ('ok', 'failed')),
  last_error     text,
  last_found     integer NOT NULL DEFAULT 0,

  -- Conditional-GET bookkeeping, so a council that publishes weekly is not
  -- fetched in full six times a day.
  etag           text,
  last_modified  text,

  created_by   uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX watch_sources_due ON public.watch_sources (active, last_polled_at);

-- ---------------------------------------------------------------------

CREATE TABLE public.watch_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_id    uuid NOT NULL REFERENCES public.watch_sources(id) ON DELETE CASCADE,

  -- The upstream's own identifier — a bill id, a GUID, or the link. Unique per
  -- source so that re-polling a feed updates rather than duplicates.
  external_id  text NOT NULL,

  title        text NOT NULL,
  url          text NOT NULL,
  -- When the document was published upstream, not when we found it.
  published_at timestamptz,

  -- Two sentences of plain English, written by the model from the title and
  -- the upstream's own abstract. Nullable: a source polled while inference is
  -- down still produces rows with a title and a link, which is most of the
  -- value anyway.
  summary      text,

  -- 0-100, written by the model. Orders the list. Never gates it. See header.
  relevance    smallint CHECK (relevance IS NULL OR relevance BETWEEN 0 AND 100),

  -- Which of the group's own words this matched. This is what put the row here
  -- and it is computed by string matching, not by a model.
  matched_terms text[] NOT NULL DEFAULT '{}',

  state        coram.watch_item_state NOT NULL DEFAULT 'new',
  -- Who dismissed it, so two organizers do not both chase the same hearing.
  -- Never aggregated, never shown as a list. See the header note.
  dismissed_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  -- Set once this became something the group owns.
  converted_kind text CHECK (converted_kind IN ('event', 'bill')),
  converted_id   uuid,

  first_seen_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT watch_items_unique_per_source UNIQUE (source_id, external_id),
  CONSTRAINT watch_items_converted_pair CHECK (
    (converted_kind IS NULL) = (converted_id IS NULL)
  )
);

CREATE INDEX watch_items_feed ON public.watch_items (tenant_id, state, relevance DESC NULLS LAST, published_at DESC);

-- ---------------------------------------------------------------------
-- RLS. Default deny, then the narrowest grant that makes the module work.
-- ---------------------------------------------------------------------

ALTER TABLE public.watch_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_topics  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.watch_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_sources FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.watch_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_items   FORCE  ROW LEVEL SECURITY;

-- Readable by the whole workspace, on the same reasoning as bills: what the
-- group is watching is the group's political position, and a position the
-- membership cannot see is not the membership's position. `legal` is excluded
-- in line with every other non-case table.
CREATE POLICY watch_topics_select ON public.watch_topics FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY watch_topics_write ON public.watch_topics FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY watch_sources_select ON public.watch_sources FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

-- Adding a source tells this Worker to go and fetch a URL on the group's
-- behalf, which is a narrower thing than reading a list, so it is stewards and
-- organizers only.
CREATE POLICY watch_sources_write ON public.watch_sources FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE POLICY watch_items_select ON public.watch_items FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY watch_items_write ON public.watch_items FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE TRIGGER watch_topics_touch BEFORE UPDATE ON public.watch_topics
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();
CREATE TRIGGER watch_sources_touch BEFORE UPDATE ON public.watch_sources
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_topics  TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_sources TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_items   TO coram_app;

-- The nightly sweep ages items out. It does not touch topics or sources: those
-- are the workspace's own configuration and they leave when the tenant does.
GRANT SELECT, DELETE ON public.watch_items TO coram_cron;

-- The poller runs as cron across every tenant, so it needs to write what it
-- found and record whether the fetch worked.
GRANT SELECT, INSERT, UPDATE ON public.watch_items   TO coram_cron;
GRANT SELECT, UPDATE           ON public.watch_sources TO coram_cron;
GRANT SELECT                   ON public.watch_topics  TO coram_cron;
