
-- ================================================================
-- PHASE 22Ω HARDENING MIGRATION
-- A1: CHECK constraints on life_events
-- A2: entity_id NOT NULL
-- B1: Rewrite set_relational_orientation with tenant-scoped role check
-- B2: Orientation audit table
-- ================================================================

-- A2: Make entity_id NOT NULL (all rows already have values via trigger)
ALTER TABLE public.life_events ALTER COLUMN entity_id SET NOT NULL;

-- A1: CHECK constraints for polymorphic invariants
ALTER TABLE public.life_events ADD CONSTRAINT chk_entity_type_allowed
  CHECK (entity_type IN ('person', 'partner'));

ALTER TABLE public.life_events ADD CONSTRAINT chk_person_shadow_sync
  CHECK (
    (entity_type = 'person' AND person_id IS NOT NULL AND entity_id = person_id)
    OR
    (entity_type != 'person' AND person_id IS NULL)
  );

-- B2: Orientation audit table
CREATE TABLE IF NOT EXISTS public.tenant_orientation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  old_orientation text,
  new_orientation text NOT NULL,
  old_people_richness smallint,
  new_people_richness smallint,
  old_partner_richness smallint,
  new_partner_richness smallint,
  auto_manage_before boolean,
  auto_manage_after boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_orientation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stewards can view orientation audit"
  ON public.tenant_orientation_audit FOR SELECT
  USING (has_any_tenant_role(tenant_id, ARRAY['admin', 'regional_lead']::text[]));

CREATE POLICY "System insert only"
  ON public.tenant_orientation_audit FOR INSERT
  WITH CHECK (false);
-- Inserts happen via SECURITY DEFINER function only

-- B1: Rewrite set_relational_orientation with tenant-scoped role check + audit
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
  v_old record;
BEGIN
  -- Validate membership
  IF NOT is_tenant_member(p_tenant_id, v_caller) THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  -- Tenant-scoped role gate: only admin or regional_lead (steward/shepherd)
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = v_caller
      AND tenant_id = p_tenant_id
      AND role IN ('admin', 'regional_lead')
  ) THEN
    RAISE EXCEPTION 'Insufficient role: only Steward or Shepherd may change relational orientation';
  END IF;

  -- Validate orientation value
  IF p_orientation NOT IN ('human_focused','institution_focused','hybrid') THEN
    RAISE EXCEPTION 'Invalid orientation: %', p_orientation;
  END IF;

  -- Capture old values for audit
  SELECT relational_orientation, people_richness_level, partner_richness_level, auto_manage_richness
  INTO v_old
  FROM tenants WHERE id = p_tenant_id;

  IF p_auto_manage THEN
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
    UPDATE tenants SET
      relational_orientation = p_orientation,
      auto_manage_richness = false
    WHERE id = p_tenant_id;
  END IF;

  -- Write audit record (bypasses RLS via SECURITY DEFINER)
  INSERT INTO tenant_orientation_audit (
    tenant_id, actor_id,
    old_orientation, new_orientation,
    old_people_richness, new_people_richness,
    old_partner_richness, new_partner_richness,
    auto_manage_before, auto_manage_after
  ) VALUES (
    p_tenant_id, v_caller,
    v_old.relational_orientation, p_orientation,
    v_old.people_richness_level,
    CASE WHEN p_auto_manage THEN
      CASE p_orientation WHEN 'human_focused' THEN 3 WHEN 'institution_focused' THEN 1 WHEN 'hybrid' THEN 3 END
    ELSE v_old.people_richness_level END,
    v_old.partner_richness_level,
    CASE WHEN p_auto_manage THEN
      CASE p_orientation WHEN 'human_focused' THEN 1 WHEN 'institution_focused' THEN 3 WHEN 'hybrid' THEN 3 END
    ELSE v_old.partner_richness_level END,
    v_old.auto_manage_richness, p_auto_manage
  );
END;
$$;
