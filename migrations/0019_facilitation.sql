-- ---------------------------------------------------------------------
-- 0019 — running the meeting
--
-- Part of Consilium (§5.8). An agenda with a time against each item, and the
-- minutes it becomes afterwards — which 0007 already has a table for.
--
-- ---------------------------------------------------------------------
-- The speaking stack is not here, and its absence is the design
-- ---------------------------------------------------------------------
--
-- A facilitation tool's most-requested feature is a stack: who has asked to
-- speak, in order, and often who has already spoken and how often, so a
-- facilitator can balance the room. It is genuinely useful and it is the one
-- thing this migration will never contain.
--
-- A stored stack is a record of who was in a room on a particular evening and
-- how much each of them said. For a tenants' union meeting about a landlord, a
-- immigration clinic, or a strike committee, that is the single most damaging
-- document the group could produce about itself — and unlike a contact list it
-- has no operational value the day after the meeting ends.
--
-- So the stack lives in the facilitator's browser for the length of the meeting
-- and is never sent anywhere. Closing the tab is the deletion. The screen says
-- so, because a promise nobody is told about is not a feature.
--
-- What is stored is the plan and the outcome: an agenda somebody wrote, and the
-- minutes the group adopts. Both are documents the group means to keep.
-- ---------------------------------------------------------------------

CREATE TABLE public.agendas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  title      text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  met_on     date NOT NULL DEFAULT current_date,

  /*
   * The items, whole.
   *
   * jsonb rather than a child table for the same reason contacts.custom_fields
   * is: this is read and written as one object, always, and never queried
   * across rows. A child table would buy ordering constraints we would then
   * have to maintain by hand anyway.
   *
   * Shape: [{ title, minutes, note }]. `note` is what happened, typed during
   * the meeting — about the item, never about a person. The application caps
   * the count and the lengths.
   */
  items      jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),

  -- Set when a facilitator starts running it, so a half-finished meeting can be
  -- picked up on somebody else's laptop if the first one dies.
  started_at  timestamptz,
  finished_at timestamptz,

  created_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agendas_tenant_idx ON public.agendas (tenant_id, met_on DESC);

ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendas FORCE  ROW LEVEL SECURITY;

-- The whole workspace can read the agenda. A meeting whose agenda the
-- membership cannot see before it starts is not the membership's meeting —
-- same reasoning as bills. `legal` excluded as everywhere else.
CREATE POLICY agendas_select ON public.agendas FOR SELECT TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND NOT coram.has_role('legal'));

CREATE POLICY agendas_write ON public.agendas FOR ALL TO coram_app
  USING (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'))
  WITH CHECK (tenant_id = coram.current_tenant_id() AND coram.has_role('steward', 'organizer'));

CREATE TRIGGER agendas_touch BEFORE UPDATE ON public.agendas
  FOR EACH ROW EXECUTE FUNCTION coram.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendas TO coram_app;
GRANT SELECT, DELETE ON public.agendas TO coram_cron;
