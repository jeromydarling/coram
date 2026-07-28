
-- ═══════════════════════════════════════════════════════════════
-- TERRITORIES UNIFICATION — Phase 1 Schema Foundation
-- ═══════════════════════════════════════════════════════════════

-- 1. Territory type enum
CREATE TYPE public.territory_type AS ENUM (
  'metro', 'county', 'state', 'country', 'mission_field', 'custom_region'
);

-- 2. Territories table
CREATE TABLE public.territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_type public.territory_type NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.territories(id),
  state_code text,
  country_code text DEFAULT 'US',
  centroid_lat numeric,
  centroid_lng numeric,
  population_estimate integer,
  metro_id uuid REFERENCES public.metros(id),  -- back-link for migrated metros
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_territories_type ON public.territories(territory_type);
CREATE INDEX idx_territories_parent ON public.territories(parent_id);
CREATE INDEX idx_territories_metro ON public.territories(metro_id) WHERE metro_id IS NOT NULL;
CREATE INDEX idx_territories_country ON public.territories(country_code);

ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- Territories are readable by all authenticated users
CREATE POLICY "Authenticated users can read territories"
  ON public.territories FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage territories
CREATE POLICY "Admins can manage territories"
  ON public.territories FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[]));

-- 3. Migrate existing metros into territories
INSERT INTO public.territories (territory_type, name, state_code, centroid_lat, centroid_lng, metro_id, active)
SELECT 'metro'::public.territory_type, metro, state_code, lat, lng, id, active
FROM public.metros
WHERE deleted_at IS NULL;

-- 4. Tenant territories (replaces tenant_metros over time)
CREATE TABLE public.tenant_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  territory_id uuid NOT NULL REFERENCES public.territories(id),
  bundle_id uuid,  -- groups county bundles
  activation_slots integer NOT NULL DEFAULT 1,
  is_home boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, territory_id)
);

CREATE INDEX idx_tenant_territories_tenant ON public.tenant_territories(tenant_id);
CREATE INDEX idx_tenant_territories_bundle ON public.tenant_territories(bundle_id) WHERE bundle_id IS NOT NULL;

ALTER TABLE public.tenant_territories ENABLE ROW LEVEL SECURITY;

-- Tenant members can read their own territory assignments
CREATE POLICY "Tenant members can read own territories"
  ON public.tenant_territories FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_territories.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Stewards + admins can manage tenant territories
CREATE POLICY "Stewards can manage tenant territories"
  ON public.tenant_territories FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.tenant_id = tenant_territories.tenant_id
        AND tu.user_id = auth.uid()
        AND ur.role IN ('steward', 'admin')
    )
  );

-- Admins/leadership full access
CREATE POLICY "Admins can manage all tenant territories"
  ON public.tenant_territories FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[]));

-- 5. Backfill tenant_territories from tenant_metros
INSERT INTO public.tenant_territories (tenant_id, territory_id, is_home)
SELECT tm.tenant_id, t.id, true
FROM public.tenant_metros tm
JOIN public.territories t ON t.metro_id = tm.metro_id
ON CONFLICT (tenant_id, territory_id) DO NOTHING;

-- 6. Solo Caregiver base location fields on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS base_country_code text,
  ADD COLUMN IF NOT EXISTS base_state_code text,
  ADD COLUMN IF NOT EXISTS base_city text,
  ADD COLUMN IF NOT EXISTS caregiver_network_opt_in boolean NOT NULL DEFAULT false;

-- 7. Missionary Organization archetype
INSERT INTO public.archetypes (key, name, description, default_tier, default_flags, default_journey_stages, default_keywords)
VALUES (
  'missionary_org',
  'Missionary Organization',
  'Organizations serving cross-cultural or international mission fields. Territory activation uses country-level geography with optional mission field sub-regions.',
  'core',
  '{"civitas": true, "voluntarium": true, "provisio": true, "signum": false, "testimonium": false, "impulsus": false, "relatio": false}'::jsonb,
  '["Found", "First Conversation", "Discovery", "Partnership Formed", "Serving Together", "Growing Together"]'::jsonb,
  '["missions", "international", "cross-cultural", "outreach", "field workers", "support raising"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 8. Activation slot calculation function
CREATE OR REPLACE FUNCTION public.calculate_territory_slots(
  p_territory_type public.territory_type,
  p_count integer DEFAULT 1
)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_territory_type
    WHEN 'metro' THEN p_count         -- 1 metro = 1 slot
    WHEN 'county' THEN CEIL(p_count::numeric / 5)::integer  -- 5 counties = 1 slot
    WHEN 'state' THEN p_count * 2     -- 1 state = 2 slots
    WHEN 'country' THEN p_count       -- 1 country = 1 slot
    WHEN 'mission_field' THEN 0       -- free if parent country activated
    WHEN 'custom_region' THEN p_count -- 1 region = 1 slot
    ELSE p_count
  END;
$$;
