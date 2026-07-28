
-- ============================================================
-- PHASE 22Ω — MIGRATION A0–A7
-- Relational Orientation + Life Events Polymorphism + Archive
-- ============================================================

-- ─── A0: is_tenant_member helper (SECURITY INVOKER, STABLE) ───
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  );
$$;

-- ─── A1: tenants — relational orientation columns ───
ALTER TABLE public.tenants
  ADD COLUMN relational_orientation text NOT NULL DEFAULT 'institution_focused'
    CHECK (relational_orientation IN ('human_focused','institution_focused','hybrid')),
  ADD COLUMN people_richness_level int NOT NULL DEFAULT 1
    CHECK (people_richness_level IN (1,3)),
  ADD COLUMN partner_richness_level int NOT NULL DEFAULT 3
    CHECK (partner_richness_level IN (1,3)),
  ADD COLUMN auto_manage_richness boolean NOT NULL DEFAULT true;

-- ─── A2: tenant_settings — seasonal echoes ───
ALTER TABLE public.tenant_settings
  ADD COLUMN seasonal_echoes_enabled boolean NOT NULL DEFAULT true;

-- ─── A3: set_relational_orientation RPC ───
CREATE OR REPLACE FUNCTION public.set_relational_orientation(
  p_tenant_id uuid,
  p_orientation text,
  p_auto_manage boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Validate membership
  IF NOT is_tenant_member(p_tenant_id, v_caller) THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  -- Role gate: only Steward or Shepherd may change orientation
  IF NOT (
    has_role(v_caller, 'steward') OR has_role(v_caller, 'shepherd')
  ) THEN
    RAISE EXCEPTION 'Insufficient role: only Steward or Shepherd may change relational orientation';
  END IF;

  -- Validate orientation value
  IF p_orientation NOT IN ('human_focused','institution_focused','hybrid') THEN
    RAISE EXCEPTION 'Invalid orientation: %', p_orientation;
  END IF;

  IF p_auto_manage THEN
    -- Auto-manage: set richness defaults based on orientation
    UPDATE tenants SET
      relational_orientation = p_orientation,
      auto_manage_richness = true,
      people_richness_level = CASE p_orientation
        WHEN 'human_focused' THEN 3
        WHEN 'institution_focused' THEN 1
        WHEN 'hybrid' THEN 3
      END,
      partner_richness_level = CASE p_orientation
        WHEN 'human_focused' THEN 1
        WHEN 'institution_focused' THEN 3
        WHEN 'hybrid' THEN 3
      END
    WHERE id = p_tenant_id;
  ELSE
    -- Manual mode: only update orientation + auto_manage flag, do NOT clobber richness
    UPDATE tenants SET
      relational_orientation = p_orientation,
      auto_manage_richness = false
    WHERE id = p_tenant_id;
  END IF;
END;
$$;

-- ─── A4: life_events polymorphism ───

-- Step 1: Drop NOT NULL on person_id (FK stays, just nullable now)
ALTER TABLE public.life_events ALTER COLUMN person_id DROP NOT NULL;

-- Step 2: Add polymorphic columns
ALTER TABLE public.life_events
  ADD COLUMN entity_type text NOT NULL DEFAULT 'person'
    CHECK (entity_type IN ('person','partner')),
  ADD COLUMN entity_id uuid;

-- Step 3: Backfill entity_id from person_id
UPDATE public.life_events
  SET entity_id = person_id
  WHERE entity_id IS NULL AND person_id IS NOT NULL;

-- Step 4: Canonical sync trigger
CREATE OR REPLACE FUNCTION public.life_events_entity_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- entity_id is always required
  IF NEW.entity_id IS NULL THEN
    RAISE EXCEPTION 'life_events.entity_id must not be null';
  END IF;

  IF NEW.entity_type = 'person' THEN
    -- Shadow person_id for legacy reads
    NEW.person_id := NEW.entity_id;
  ELSE
    -- Non-person entities: person_id must be NULL
    NEW.person_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER life_events_entity_sync
  BEFORE INSERT OR UPDATE ON public.life_events
  FOR EACH ROW
  EXECUTE FUNCTION public.life_events_entity_sync();

-- Step 5: Index for polymorphic queries
CREATE INDEX idx_life_events_entity ON public.life_events (tenant_id, entity_type, entity_id);

-- ─── A5: entity_richness_overrides ───
CREATE TABLE public.entity_richness_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  entity_type text NOT NULL CHECK (entity_type IN ('person','partner')),
  entity_id uuid NOT NULL,
  richness_level int NOT NULL CHECK (richness_level IN (1,3)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

ALTER TABLE public.entity_richness_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view overrides"
  ON public.entity_richness_overrides FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can insert overrides"
  ON public.entity_richness_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update overrides"
  ON public.entity_richness_overrides FOR UPDATE
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can delete overrides"
  ON public.entity_richness_overrides FOR DELETE
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- ─── A6: Archive tables ───

-- archive_suggestion_candidates
CREATE TABLE public.archive_suggestion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  entity_type text NOT NULL CHECK (entity_type IN ('person','partner')),
  entity_id uuid NOT NULL,
  pattern_type text NOT NULL CHECK (pattern_type IN ('anniversary','cyclical','seasonal')),
  pattern_key text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  source_period tstzrange,
  match_period tstzrange,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.archive_suggestion_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view archive candidates"
  ON public.archive_suggestion_candidates FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update archive candidates"
  ON public.archive_suggestion_candidates FOR UPDATE
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- archive_reflections
CREATE TABLE public.archive_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  entity_type text NOT NULL CHECK (entity_type IN ('person','partner')),
  entity_id uuid NOT NULL,
  candidate_id uuid REFERENCES public.archive_suggestion_candidates(id),
  noticing text,
  gratitude text,
  movement text,
  invitation text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.archive_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view archive reflections"
  ON public.archive_reflections FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can insert archive reflections"
  ON public.archive_reflections FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update archive reflections"
  ON public.archive_reflections FOR UPDATE
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- narrative_influence_events
CREATE TABLE public.narrative_influence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  influence_type text NOT NULL CHECK (influence_type IN ('seasonal_echo','archive_match')),
  source_id uuid,
  target_surface text NOT NULL CHECK (target_surface IN ('compass_summary','providence_thread')),
  confidence numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.narrative_influence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view narrative influence"
  ON public.narrative_influence_events FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can insert narrative influence"
  ON public.narrative_influence_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));
