-- =====================================================================
-- 0009_custos — safety infrastructure (§5.9).
-- Forward-only. Do not edit after it has run anywhere.
--
-- "Highest scrutiny for data minimization. Legal role only."
--
-- Two things make this migration different from every other one in the repo.
--
-- First, the `legal` role — denied every CRM table by §4.1 — is the only role
-- that can read anything here. And, unusually, **a steward cannot either**.
-- Owning the workspace does not entitle you to the jail-support list. That will
-- look like a bug to whoever next reads these policies, so: it is not. A
-- steward can appoint and remove the legal role, and can burn the whole
-- workspace. What they cannot do is read who was arrested. Role separation
-- that the owner can override is not role separation.
--
-- Second, retention is 30 days from case close, not from creation, and it
-- falls out of the existing sweep rather than needing a special job: an open
-- case has a NULL closed_at, NULL fails the age comparison, and the row
-- survives. Close the case and the clock starts. §5.9 asks for a hard purge and
-- this is it — no soft-delete, no archive, no export-before-purge.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Legal observer intake (§5.9)
-- ---------------------------------------------------------------------

CREATE TABLE public.observer_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- What was seen. Free text, and the form says plainly that it should describe
  -- conduct rather than name people who have not consented to being named.
  narrative  text NOT NULL,

  -- Where, as a place name a human would say — "outside the county building".
  -- Not coordinates: §3.7 forbids precise geolocation permanently, and a legal
  -- observer's phone is exactly the device we least want producing a track.
  location_name text,
  occurred_on   date NOT NULL,

  -- The observer, if they chose to be identified. Nullable because an
  -- anonymous report is often the only one someone is willing to file.
  observer_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set when the matter this relates to is finished. Starts the purge clock.
  closed_at  timestamptz
);

CREATE INDEX observer_reports_tenant_idx ON public.observer_reports (tenant_id, occurred_on DESC);

-- ---------------------------------------------------------------------
-- Jail support (§5.9)
--
-- The most sensitive table in the product. Everything here is the minimum
-- needed to get someone out and let their people know where they are.
-- ---------------------------------------------------------------------

CREATE TABLE public.jail_support_cases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- A name, because you cannot bail out a uuid. Deliberately not a link to
  -- contacts: an arrest must not write itself into the CRM, where it would be
  -- visible to organizers and kept under a two-year rule instead of thirty
  -- days.
  person_name text NOT NULL,

  -- Where they are held, as a facility name.
  facility    text,
  booking_ref text,

  status      text NOT NULL DEFAULT 'held'
                CHECK (status IN ('held', 'released', 'transferred', 'unknown')),

  -- What a support crew needs to act. Not a charge history, not a record.
  needs_bail_cents bigint CHECK (needs_bail_cents IS NULL OR needs_bail_cents >= 0),
  next_hearing_on  date,
  notes            text,

  arrested_on timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,

  created_by  uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- §5.9: "a 30-day hard purge after case close". This column is the clock.
  closed_at   timestamptz
);

CREATE INDEX jail_support_open_idx ON public.jail_support_cases (tenant_id, status)
  WHERE closed_at IS NULL;

-- ---------------------------------------------------------------------
-- Emergency contact trees (§5.9)
--
-- Who to call, in what order, when something happens. A tree rather than a
-- list: each entry may have a parent, so a branch can be walked without
-- waking everyone at once.
-- ---------------------------------------------------------------------

CREATE TABLE public.contact_trees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE public.contact_tree_nodes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tree_id   uuid NOT NULL REFERENCES public.contact_trees(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.contact_tree_nodes(id) ON DELETE CASCADE,

  -- Held here rather than referenced from contacts, on purpose. An emergency
  -- contact is frequently someone's partner or lawyer, who is not a supporter
  -- of the group and must not become a CRM record because of it.
  display_name text NOT NULL,
  phone        text,
  email        text,
  role_note    text,

  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tree_nodes_reachable CHECK (phone IS NOT NULL OR email IS NOT NULL),
  CONSTRAINT tree_nodes_no_self_parent CHECK (parent_id IS DISTINCT FROM id)
);

CREATE INDEX contact_tree_nodes_tree_idx ON public.contact_tree_nodes (tree_id, parent_id, position);

-- ---------------------------------------------------------------------
-- Know-your-rights, by state (§5.9), and risk briefings
-- ---------------------------------------------------------------------

CREATE TABLE public.rights_guides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Two-letter state code. stateFips (ported from CROS) is the source list.
  state_code text NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  title      text NOT NULL,
  body       text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, state_code, title)
);

CREATE TABLE public.risk_briefings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Optional link to the action this briefs. ON DELETE SET NULL so cancelling
  -- an event does not silently destroy the assessment written for it.
  event_id   uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title      text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz
);

-- ---------------------------------------------------------------------
-- Default deny
-- ---------------------------------------------------------------------

ALTER TABLE public.observer_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observer_reports    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.jail_support_cases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jail_support_cases  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.contact_trees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_trees       FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.contact_tree_nodes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tree_nodes  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.rights_guides       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rights_guides       FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.risk_briefings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_briefings      FORCE  ROW LEVEL SECURITY;

/*
 * `legal` only. Not legal-plus-steward.
 *
 * If you are here because a steward complained they cannot see the jail
 * support board: that is the feature. Point them at §5.9 and at the fact that
 * they can appoint whoever they like to the legal role. Widening this policy is
 * how a workspace owner ends up compelled to produce a list of who was
 * arrested, having previously been able to say truthfully that they could not
 * see it.
 */
CREATE POLICY observer_reports_all ON public.observer_reports FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'));

CREATE POLICY jail_support_all ON public.jail_support_cases FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'));

CREATE POLICY contact_trees_all ON public.contact_trees FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'));

CREATE POLICY contact_tree_nodes_all ON public.contact_tree_nodes FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('legal'));

/*
 * The two exceptions, and they are exceptions on purpose.
 *
 * Know-your-rights and risk briefings are the parts of Custos that only work if
 * everyone can read them. A rights guide the members cannot open before an
 * action is a rights guide that does nothing. These hold no personal data at
 * all — they are documents the group wrote for itself.
 */
CREATE POLICY rights_guides_select ON public.rights_guides FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id());

CREATE POLICY rights_guides_write ON public.rights_guides FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('legal', 'steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('legal', 'steward'));

CREATE POLICY risk_briefings_select ON public.risk_briefings FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id());

CREATE POLICY risk_briefings_write ON public.risk_briefings FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('legal', 'steward'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('legal', 'steward'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.observer_reports   TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jail_support_cases TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_trees      TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_tree_nodes TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rights_guides      TO coram_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_briefings     TO coram_app;

GRANT SELECT, UPDATE, DELETE ON public.observer_reports   TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.jail_support_cases TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.contact_tree_nodes TO coram_cron;
GRANT SELECT, UPDATE, DELETE ON public.risk_briefings     TO coram_cron;

/*
 * Closing a case starts the 30-day clock, and does so in one place.
 *
 * A handler setting closed_at directly would work, but this exists so the
 * release status and the clock cannot drift apart — a case marked released
 * with a NULL closed_at would sit in the table indefinitely, which is exactly
 * the failure §5.9's hard purge is written against.
 */
CREATE FUNCTION coram.close_jail_support_case(_case_id uuid, _status text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE _closed timestamptz;
BEGIN
  IF NOT coram.has_role('legal') THEN
    RAISE EXCEPTION 'coram: only the legal role may close a case'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _status NOT IN ('released', 'transferred', 'unknown') THEN
    RAISE EXCEPTION 'coram: a case closes as released, transferred, or unknown'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.jail_support_cases
  SET status = _status,
      released_at = CASE WHEN _status = 'released' THEN coalesce(released_at, now()) ELSE released_at END,
      closed_at = now()
  WHERE id = _case_id AND tenant_id = coram.current_tenant_id() AND closed_at IS NULL
  RETURNING closed_at INTO _closed;

  IF _closed IS NULL THEN
    RAISE EXCEPTION 'coram: no such open case' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN _closed;
END;
$$;

REVOKE ALL ON FUNCTION coram.close_jail_support_case(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.close_jail_support_case(uuid, text) TO coram_app;

COMMIT;
