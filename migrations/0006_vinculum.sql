-- =====================================================================
-- 0006_vinculum — relational organizing (§5.2).
-- Forward-only. Do not edit after it has run anywhere.
--
-- "The piece competitors sell as a separate product. Here it shares the
-- contact record."
--
-- The decision that shapes this migration: a one-to-one is logged as structure,
-- never as prose. There is an outcome code, a next step, and a ladder move —
-- and no notes column. What an organizer actually thinks about a person goes in
-- contact_notes, encrypted in the browser under a key the server does not hold
-- (§3.3). Splitting it that way is the difference between a subpoena returning
-- "47 conversations, outcomes coded" and returning 47 paragraphs about named
-- people's politics, families, and fears.
--
-- relationship_edges is ported from CROS. Its shape carried over unchanged;
-- its access control did not. The original shipped
--   USING (auth.role() = 'authenticated')
-- with no tenant predicate and no tenant_id column, so any signed-in user of
-- any workspace could read every edge in the database. That is fixed here, and
-- it is the reason the salvage map marks these policies as read-then-rewrite
-- rather than port.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Organizer trees (§5.2)
--
-- An organizer reports to another organizer. Used for escalation and for
-- rolling a turf's numbers up a chain, not for granting access — access still
-- comes from turf, so a lead organizer does not silently acquire every contact
-- their reports hold.
-- ---------------------------------------------------------------------

ALTER TABLE public.memberships
  ADD COLUMN reports_to uuid REFERENCES public.memberships(id) ON DELETE SET NULL;

CREATE INDEX memberships_reports_to_idx ON public.memberships (reports_to)
  WHERE reports_to IS NOT NULL;

-- A membership reporting to itself would loop the escalation walk forever.
ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_no_self_report CHECK (reports_to IS DISTINCT FROM id);

-- ---------------------------------------------------------------------
-- Outcome codes — configurable per tenant (§5.2)
-- ---------------------------------------------------------------------

CREATE TABLE public.outcome_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code       text NOT NULL,
  label      text NOT NULL,
  -- Whether this outcome counts as forward motion. Drives the follow-up queue
  -- ordering and nothing else; it is not a score attached to a person.
  is_positive boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- ---------------------------------------------------------------------
-- Ladders of engagement — configurable per tenant (§5.2)
-- ---------------------------------------------------------------------

CREATE TABLE public.ladders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE public.ladder_rungs (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ladder_id uuid NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  name      text NOT NULL,
  position  integer NOT NULL,
  -- Every table names a column the sweep can measure age against, even one
  -- that is never swept. The alternative was pointing the registry at a uuid,
  -- which would have satisfied the CI gate and meant nothing.
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ladder_id, position)
);

-- Where one contact currently sits on one ladder. Current position only; the
-- history of how they got there is the sequence of one_to_ones, which ages out
-- on its own schedule rather than accumulating a permanent record of someone's
-- political development.
CREATE TABLE public.ladder_placements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  ladder_id  uuid NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  rung_id    uuid NOT NULL REFERENCES public.ladder_rungs(id) ON DELETE CASCADE,
  moved_at   timestamptz NOT NULL DEFAULT now(),
  moved_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (contact_id, ladder_id)
);

CREATE INDEX ladder_placements_rung_idx ON public.ladder_placements (rung_id);

-- ---------------------------------------------------------------------
-- One-to-ones (§5.2)
--
-- No notes column. See the header.
-- ---------------------------------------------------------------------

CREATE TABLE public.one_to_ones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organizer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  outcome_code_id uuid REFERENCES public.outcome_codes(id) ON DELETE SET NULL,

  -- What was agreed. Short, and about the work rather than the person:
  -- "bringing two neighbours Thursday", not "worried about her job".
  next_step   text,

  -- If the conversation moved them, which rung they moved to. Recorded here so
  -- the move and its reason live in one row.
  moved_to_rung_id uuid REFERENCES public.ladder_rungs(id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX one_to_ones_contact_idx ON public.one_to_ones (contact_id, occurred_at DESC);
CREATE INDEX one_to_ones_organizer_idx ON public.one_to_ones (organizer_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- Assignment (§5.2)
-- ---------------------------------------------------------------------

CREATE TABLE public.assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  -- The membership, not the user, so an assignment dies with the person's role
  -- in this workspace rather than following them out of it.
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (contact_id, membership_id)
);

CREATE INDEX assignments_membership_idx ON public.assignments (membership_id);

-- ---------------------------------------------------------------------
-- Follow-up queue with snooze and escalation (§5.2)
-- ---------------------------------------------------------------------

CREATE TABLE public.follow_ups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  reason      text NOT NULL,
  due_at      timestamptz NOT NULL,

  -- Snooze moves the due date without losing why it was raised. NULL means not
  -- snoozed; a date in the future hides it from the queue until then.
  snoozed_until timestamptz,
  snooze_count  integer NOT NULL DEFAULT 0,

  -- Set when it has been passed up the organizer tree. Escalation does not
  -- reassign — the original organizer keeps it, and their lead can now see it
  -- is overdue.
  escalated_at  timestamptz,
  escalated_to  uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  status      text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'done', 'dropped')),
  closed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX follow_ups_queue_idx
  ON public.follow_ups (membership_id, coalesce(snoozed_until, due_at))
  WHERE status = 'open';
CREATE INDEX follow_ups_contact_idx ON public.follow_ups (contact_id);

-- ---------------------------------------------------------------------
-- relationship_edges — ported from CROS, with the tenant boundary it lacked
-- ---------------------------------------------------------------------

CREATE TABLE public.relationship_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The column the original did not have, and the reason its policy could not
  -- have been written correctly even if someone had tried.
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  source_type text NOT NULL CHECK (source_type IN ('contact', 'event', 'fund', 'turf')),
  source_id   uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('contact', 'event', 'fund', 'turf')),
  target_id   uuid NOT NULL,

  -- Why we think these two are connected: 'co_attended', 'referred_by',
  -- 'same_household', 'invited'. Kept short and drawn from things the product
  -- observed, not inferred about people.
  edge_reason text NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Carried over from CROS. Makes ingestion idempotent, which is what let the
  -- original upsert run repeatedly without duplicating the graph.
  CONSTRAINT relationship_edges_unique UNIQUE (tenant_id, source_type, source_id, target_type, target_id)
);

CREATE INDEX relationship_edges_source_idx ON public.relationship_edges (tenant_id, source_type, source_id);
CREATE INDEX relationship_edges_target_idx ON public.relationship_edges (tenant_id, target_type, target_id);

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.outcome_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_codes       FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ladders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ladders             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ladder_rungs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ladder_rungs        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ladder_placements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ladder_placements   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.one_to_ones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_to_ones         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.relationship_edges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_edges  FORCE  ROW LEVEL SECURITY;

-- Configuration: workspace vocabulary, readable by everyone but `legal`.
CREATE POLICY outcome_codes_select ON public.outcome_codes FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY outcome_codes_write ON public.outcome_codes FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY ladders_select ON public.ladders FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY ladders_write ON public.ladders FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

CREATE POLICY ladder_rungs_select ON public.ladder_rungs FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY ladder_rungs_write ON public.ladder_rungs FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward'));

-- Everything below is about a person, so it follows can_see_contact.
CREATE POLICY ladder_placements_select ON public.ladder_placements FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = ladder_placements.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY ladder_placements_write ON public.ladder_placements FOR ALL TO coram_app
  USING (
    coram.has_role('steward', 'organizer')
    AND EXISTS (SELECT 1 FROM public.contacts c
                WHERE c.id = ladder_placements.contact_id
                  AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id))
  )
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (SELECT 1 FROM public.contacts c
                WHERE c.id = ladder_placements.contact_id
                  AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id))
  );

CREATE POLICY one_to_ones_select ON public.one_to_ones FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = one_to_ones.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY one_to_ones_insert ON public.one_to_ones FOR INSERT TO coram_app
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (SELECT 1 FROM public.contacts c
                WHERE c.id = one_to_ones.contact_id
                  AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id))
  );

-- No UPDATE or DELETE. A logged conversation is a record of what happened, and
-- one that can be quietly rewritten afterwards is not worth keeping.
CREATE POLICY assignments_select ON public.assignments FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = assignments.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY assignments_write ON public.assignments FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (SELECT 1 FROM public.contacts c
                WHERE c.id = assignments.contact_id
                  AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id))
  );

CREATE POLICY follow_ups_select ON public.follow_ups FOR SELECT TO coram_app
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = follow_ups.contact_id
      AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ));

CREATE POLICY follow_ups_write ON public.follow_ups FOR ALL TO coram_app
  USING (
    coram.has_role('steward', 'organizer')
    AND EXISTS (SELECT 1 FROM public.contacts c
                WHERE c.id = follow_ups.contact_id
                  AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id))
  )
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND EXISTS (SELECT 1 FROM public.contacts c
                WHERE c.id = follow_ups.contact_id
                  AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id))
  );

/*
 * relationship_edges.
 *
 * Tenant-scoped, unlike the original. An edge between two contacts is visible
 * only if both ends are — an organizer must not learn that a contact outside
 * their turf exists by seeing an edge pointing at it.
 *
 * Non-contact endpoints (events, funds, turfs) are workspace-level and need no
 * per-row check beyond the tenant.
 */
CREATE FUNCTION coram.can_see_endpoint(_type text, _id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE _type
           WHEN 'contact' THEN EXISTS (
             SELECT 1 FROM public.contacts c
             WHERE c.id = _id AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
           )
           ELSE coram.current_tenant_id() IS NOT NULL
         END
$$;

CREATE POLICY relationship_edges_select ON public.relationship_edges FOR SELECT TO coram_app
  USING (
    tenant_id = coram.current_tenant_id()
    AND coram.can_see_endpoint(source_type, source_id)
    AND coram.can_see_endpoint(target_type, target_id)
  );

CREATE POLICY relationship_edges_write ON public.relationship_edges FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (
    tenant_id = coram.current_tenant_id()
    AND coram.has_role('steward', 'organizer')
    AND coram.can_see_endpoint(source_type, source_id)
    AND coram.can_see_endpoint(target_type, target_id)
  );

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outcome_codes      TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladders            TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_rungs       TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_placements  TO coram_app;
GRANT SELECT, INSERT                 ON public.one_to_ones        TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments        TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups         TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_edges TO coram_app;

GRANT SELECT, UPDATE, DELETE ON public.one_to_ones        TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.ladder_placements  TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.assignments        TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.follow_ups         TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.relationship_edges TO coram_cron;

REVOKE ALL ON FUNCTION coram.can_see_endpoint(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.can_see_endpoint(text, uuid) TO coram_app;

-- ---------------------------------------------------------------------
-- Logging a one-to-one
--
-- One call, one transaction: record the conversation, move the ladder, close
-- the follow-up that prompted it, and open the next one. Doing these
-- separately is how a queue ends up with a conversation that happened and a
-- follow-up that still says it did not.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.log_one_to_one(
  _contact_id uuid,
  _outcome_code_id uuid,
  _next_step text,
  _moved_to_rung_id uuid,
  _closes_follow_up uuid,
  _next_follow_up_at timestamptz,
  _next_follow_up_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tenant uuid := coram.current_tenant_id();
  _id     uuid;
  _ladder uuid;
  _member uuid;
BEGIN
  IF _tenant IS NULL OR NOT coram.has_role('steward', 'organizer') THEN
    RAISE EXCEPTION 'coram: not permitted to log a conversation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The contact must be one the caller can actually see. SECURITY DEFINER
  -- bypasses RLS, so the check that RLS would have made happens here instead.
  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = _contact_id AND coram.can_see_contact(c.tenant_id, c.turf_id, c.user_id)
  ) THEN
    RAISE EXCEPTION 'coram: no such contact, or not one you can see'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.one_to_ones
    (tenant_id, contact_id, organizer_id, outcome_code_id, next_step, moved_to_rung_id)
  VALUES (_tenant, _contact_id, coram.current_user_id(), _outcome_code_id, _next_step, _moved_to_rung_id)
  RETURNING id INTO _id;

  IF _moved_to_rung_id IS NOT NULL THEN
    SELECT ladder_id INTO _ladder FROM public.ladder_rungs WHERE id = _moved_to_rung_id;

    INSERT INTO public.ladder_placements
      (tenant_id, contact_id, ladder_id, rung_id, moved_by)
    VALUES (_tenant, _contact_id, _ladder, _moved_to_rung_id, coram.current_user_id())
    ON CONFLICT (contact_id, ladder_id) DO UPDATE
      SET rung_id = excluded.rung_id, moved_at = now(), moved_by = excluded.moved_by;
  END IF;

  IF _closes_follow_up IS NOT NULL THEN
    UPDATE public.follow_ups
    SET status = 'done', closed_at = now()
    WHERE id = _closes_follow_up AND tenant_id = _tenant;
  END IF;

  IF _next_follow_up_at IS NOT NULL THEN
    SELECT id INTO _member FROM public.memberships
    WHERE user_id = coram.current_user_id() AND tenant_id = _tenant;

    INSERT INTO public.follow_ups (tenant_id, contact_id, membership_id, reason, due_at)
    VALUES (_tenant, _contact_id, _member,
            coalesce(_next_follow_up_reason, 'Following up on a conversation'),
            _next_follow_up_at);
  END IF;

  -- Membra's engagement signal. Explicitly logged contact, never a passive
  -- open or click — see the note on contacts.last_interaction_at.
  UPDATE public.contacts SET last_interaction_at = now() WHERE id = _contact_id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION coram.log_one_to_one(uuid, uuid, text, uuid, uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.log_one_to_one(uuid, uuid, text, uuid, uuid, timestamptz, text) TO coram_app;

-- ---------------------------------------------------------------------
-- Escalation
--
-- Walks the organizer tree one step and marks the follow-up as escalated. It
-- does not reassign: the original organizer keeps the relationship, and their
-- lead simply gains sight of the fact that it is overdue. Reassigning on a
-- missed date would take a contact away from the person who actually knows
-- them, which is worse for the contact and worse for the organizing.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.escalate_follow_up(_follow_up_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _tenant uuid := coram.current_tenant_id();
  _lead   uuid;
BEGIN
  SELECT m.reports_to INTO _lead
  FROM public.follow_ups f
  JOIN public.memberships m ON m.id = f.membership_id
  WHERE f.id = _follow_up_id AND f.tenant_id = _tenant;

  IF _lead IS NULL THEN RETURN NULL; END IF;

  UPDATE public.follow_ups
  SET escalated_at = now(), escalated_to = _lead
  WHERE id = _follow_up_id AND tenant_id = _tenant AND escalated_at IS NULL;

  RETURN _lead;
END;
$$;

REVOKE ALL ON FUNCTION coram.escalate_follow_up(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.escalate_follow_up(uuid) TO coram_app;

COMMIT;
