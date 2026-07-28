
-- ============================================================
-- Phase 7L: Archetype Simulation Engine
-- ============================================================

-- 1) archetype_profiles — behavioral templates for simulation
CREATE TABLE public.archetype_profiles (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  behavior_profile jsonb NOT NULL DEFAULT '{}',
  narrative_style text NOT NULL DEFAULT 'neutral',
  communio_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.archetype_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read archetype_profiles"
  ON public.archetype_profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert archetype_profiles"
  ON public.archetype_profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update archetype_profiles"
  ON public.archetype_profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete archetype_profiles"
  ON public.archetype_profiles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) archetype_simulation_runs — tracks each tick execution
CREATE TABLE public.archetype_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  archetype_key text NOT NULL REFERENCES public.archetype_profiles(key),
  tick_key text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  stats jsonb NOT NULL DEFAULT '{}',
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(tenant_id, tick_key)
);

ALTER TABLE public.archetype_simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read simulation_runs"
  ON public.archetype_simulation_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert simulation_runs"
  ON public.archetype_simulation_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update simulation_runs"
  ON public.archetype_simulation_runs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_simulation_runs_tenant ON public.archetype_simulation_runs(tenant_id, created_at DESC);
CREATE INDEX idx_simulation_runs_status ON public.archetype_simulation_runs(status);

-- 3) Seed the 5 core archetype profiles
INSERT INTO public.archetype_profiles (key, display_name, behavior_profile, narrative_style, communio_default) VALUES
  ('church', 'Church / Faith Community', '{"reflection_rate": 0.7, "event_rate": 0.8, "volunteer_rate": 0.9, "provisio_rate": 0.3, "email_rate": 0.4, "journey_advance_rate": 0.15, "communio_share_rate": 0.5}', 'warm_pastoral', true),
  ('social_enterprise', 'Social Enterprise', '{"reflection_rate": 0.4, "event_rate": 0.5, "volunteer_rate": 0.2, "provisio_rate": 0.7, "email_rate": 0.8, "journey_advance_rate": 0.25, "communio_share_rate": 0.3}', 'professional_impact', false),
  ('workforce_dev', 'Workforce Development Nonprofit', '{"reflection_rate": 0.5, "event_rate": 0.6, "volunteer_rate": 0.4, "provisio_rate": 0.5, "email_rate": 0.6, "journey_advance_rate": 0.2, "communio_share_rate": 0.4}', 'outcomes_driven', true),
  ('community_tech', 'Community Tech Organization', '{"reflection_rate": 0.5, "event_rate": 0.7, "volunteer_rate": 0.6, "provisio_rate": 0.8, "email_rate": 0.5, "journey_advance_rate": 0.2, "communio_share_rate": 0.6}', 'inclusive_technical', true),
  ('volunteer_network', 'Volunteer Network', '{"reflection_rate": 0.6, "event_rate": 0.9, "volunteer_rate": 1.0, "provisio_rate": 0.2, "email_rate": 0.3, "journey_advance_rate": 0.1, "communio_share_rate": 0.7}', 'community_voice', true);
