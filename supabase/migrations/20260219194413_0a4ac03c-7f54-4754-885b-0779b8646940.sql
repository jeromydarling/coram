
-- ============================================================
-- Phase 7O: Archetype Defaults Engine
-- ============================================================

-- 1) archetype_defaults — deterministic config per archetype
CREATE TABLE public.archetype_defaults (
  archetype text NOT NULL,
  config_key text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (archetype, config_key)
);

ALTER TABLE public.archetype_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read archetype_defaults"
  ON public.archetype_defaults FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- 2) tenant_journey_stages — per-tenant journey stage config
CREATE TABLE public.tenant_journey_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage_label text NOT NULL,
  stage_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_tenant_journey_stage ON public.tenant_journey_stages (tenant_id, stage_label);

ALTER TABLE public.tenant_journey_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read journey stages"
  ON public.tenant_journey_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_journey_stages.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin manage journey stages"
  ON public.tenant_journey_stages FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- 3) Seed archetype_defaults for all 9 archetypes
-- CHURCH
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('church', 'journey_stages', '["First Visit","Getting Connected","Active Member","Serving","Leading","Shepherding"]'),
('church', 'signum_keywords', '[{"keyword":"church outreach","category":"community","weight":5},{"keyword":"food pantry","category":"need_signals","weight":5},{"keyword":"community meals","category":"community","weight":4},{"keyword":"faith community event","category":"community","weight":4},{"keyword":"neighborhood ministry","category":"community","weight":3},{"keyword":"volunteer day","category":"community","weight":3}]'),
('church', 'communio_groups', '["Local Faith Leaders Network","Neighborhood Services Coalition"]'),
('church', 'dashboard_layout', '["alerts","recommendations","kpi-primary","pipeline-tier","tables"]');

-- WORKFORCE DEVELOPMENT
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('workforce_development', 'journey_stages', '["Employer Identified","Initial Contact","Site Visit","Placement Partner","Active Hiring","Strategic Workforce Ally"]'),
('workforce_development', 'signum_keywords', '[{"keyword":"workforce development","category":"community","weight":5},{"keyword":"job training","category":"education","weight":5},{"keyword":"apprenticeship","category":"education","weight":4},{"keyword":"hiring event","category":"community","weight":4},{"keyword":"career pathway","category":"education","weight":3},{"keyword":"skills gap","category":"need_signals","weight":3}]'),
('workforce_development', 'communio_groups', '["Regional Workforce Partners","Employer Engagement Network"]');

-- HOUSING
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('housing', 'journey_stages', '["Referral Received","Intake","Housing Search","Placed","Stabilizing","Thriving"]'),
('housing', 'signum_keywords', '[{"keyword":"affordable housing","category":"need_signals","weight":5},{"keyword":"shelter services","category":"need_signals","weight":5},{"keyword":"homelessness prevention","category":"need_signals","weight":4},{"keyword":"housing first","category":"policy","weight":4},{"keyword":"tenant support","category":"community","weight":3},{"keyword":"rapid rehousing","category":"need_signals","weight":3}]');

-- EDUCATION
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('education', 'journey_stages', '["Community Identified","Program Awareness","Enrolled","Active Learner","Completing","Alumni & Advocate"]'),
('education', 'signum_keywords', '[{"keyword":"education access","category":"education","weight":5},{"keyword":"tutoring program","category":"education","weight":5},{"keyword":"scholarship","category":"education","weight":4},{"keyword":"after school","category":"education","weight":4},{"keyword":"STEM education","category":"education","weight":3},{"keyword":"adult learning","category":"education","weight":3}]');

-- GOVERNMENT
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('government', 'journey_stages', '["Constituent Identified","Initial Engagement","Service Delivery","Ongoing Relationship","Community Champion","Policy Advocate"]'),
('government', 'signum_keywords', '[{"keyword":"civic engagement","category":"community","weight":5},{"keyword":"public services","category":"community","weight":5},{"keyword":"municipal program","category":"policy","weight":4},{"keyword":"community meeting","category":"community","weight":4},{"keyword":"resident outreach","category":"community","weight":3},{"keyword":"government partnership","category":"policy","weight":3}]');

-- SOCIAL ENTERPRISE
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('social_enterprise', 'journey_stages', '["Prospect","Discovery","Pilot","Active Client","Growth Partner","Champion"]'),
('social_enterprise', 'signum_keywords', '[{"keyword":"social enterprise","category":"community","weight":5},{"keyword":"impact investing","category":"policy","weight":5},{"keyword":"B-corp","category":"community","weight":4},{"keyword":"sustainable business","category":"community","weight":4},{"keyword":"community commerce","category":"community","weight":3},{"keyword":"inclusive economy","category":"need_signals","weight":3}]'),
('social_enterprise', 'provisio_defaults', '{"default_categories":["technology","equipment","training"],"auto_track":true}');

-- NONPROFIT PROGRAM
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('nonprofit_program', 'journey_stages', '["Identified","Outreach","Engaged","Active Partner","Sustained","Advocate"]'),
('nonprofit_program', 'signum_keywords', '[{"keyword":"nonprofit partnership","category":"community","weight":5},{"keyword":"community grant","category":"need_signals","weight":5},{"keyword":"social services","category":"community","weight":4},{"keyword":"impact report","category":"community","weight":4},{"keyword":"community development","category":"community","weight":3},{"keyword":"capacity building","category":"need_signals","weight":3}]');

-- COMMUNITY FOUNDATION
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('community_foundation', 'journey_stages', '["Awareness","Introduction","Collaborative Planning","Joint Initiative","Deep Partnership","Ecosystem Leader"]'),
('community_foundation', 'signum_keywords', '[{"keyword":"community foundation","category":"community","weight":5},{"keyword":"place-based giving","category":"community","weight":5},{"keyword":"civic engagement","category":"community","weight":4},{"keyword":"neighborhood revitalization","category":"community","weight":4},{"keyword":"coalition building","category":"community","weight":3},{"keyword":"local philanthropy","category":"community","weight":3}]');

-- PUBLIC LIBRARY / CITY PROGRAM
INSERT INTO public.archetype_defaults (archetype, config_key, config) VALUES
('public_library_or_city_program', 'journey_stages', '["Community Need Identified","Outreach","Program Launched","Growing Participation","Sustained Impact","Model Program"]'),
('public_library_or_city_program', 'signum_keywords', '[{"keyword":"library program","category":"community","weight":5},{"keyword":"digital literacy","category":"education","weight":5},{"keyword":"civic technology","category":"community","weight":4},{"keyword":"public access","category":"community","weight":4},{"keyword":"community hub","category":"community","weight":3},{"keyword":"city initiative","category":"policy","weight":3}]');

-- Add operator_schedules entry for archetype apply
INSERT INTO public.operator_schedules (key, cadence, enabled, last_status, last_stats)
VALUES ('tenant_archetype_apply', 'manual', true, NULL, '{}')
ON CONFLICT (key) DO NOTHING;
