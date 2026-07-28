
-- ============================================================
-- Caregiver System: activity types, contacts fields, privacy, season summaries
-- ============================================================

-- 1) Add caregiver activity types to enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Care Visit';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Care Check-in';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Home Support';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Transport';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Appointment Support';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'Respite';

-- 2) Add privacy + hours columns to activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hours_logged numeric NULL;

-- 3) Add care status columns to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS care_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS completion_date date NULL,
  ADD COLUMN IF NOT EXISTS date_of_passing date NULL,
  ADD COLUMN IF NOT EXISTS closing_reflection text NULL;

-- 4) Season summaries table
CREATE TABLE IF NOT EXISTS public.season_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_by uuid NULL,
  version integer NOT NULL DEFAULT 1,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  care_log_count integer NOT NULL DEFAULT 0,
  total_hours numeric NULL,
  themes text NULL,
  excerpts text NULL,
  gratitude_line text NULL,
  visibility text NOT NULL DEFAULT 'private',
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_season_summaries_tenant ON public.season_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_season_summaries_contact ON public.season_summaries(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_is_private ON public.activities(tenant_id, is_private) WHERE is_private = true;

-- RLS for season_summaries
ALTER TABLE public.season_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view season summaries"
  ON public.season_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = season_summaries.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can create season summaries"
  ON public.season_summaries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = season_summaries.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Summary creators can update own summaries"
  ON public.season_summaries FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Summary creators can delete own summaries"
  ON public.season_summaries FOR DELETE
  USING (created_by = auth.uid());

-- 5) Seed caregiver archetypes
INSERT INTO public.archetypes (key, name, description, default_tier, default_flags, default_journey_stages, default_keywords)
VALUES
  ('caregiver_solo', 'Caregiver (Solo)', 'Independent caregiver — private relationship memory and care logging.', 'core',
   '{"civitas": false, "voluntarium": false, "provisio": false, "signum": false, "testimonium": false, "impulsus": false, "relatio": false}'::jsonb,
   '["First Meeting", "Building Trust", "Ongoing Care", "Deep Companionship", "Season Closing"]'::jsonb,
   '["home care", "elder care", "respite care", "caregiver support", "companion care"]'::jsonb),
  ('caregiver_agency', 'Caregiver Agency', 'Agency managing caregivers — dignified visibility into care patterns without surveillance.', 'core',
   '{"civitas": true, "voluntarium": true, "provisio": false, "signum": false, "testimonium": false, "impulsus": false, "relatio": false}'::jsonb,
   '["Referral", "Intake", "Active Care", "Transition", "Completed"]'::jsonb,
   '["home health", "caregiver agency", "care coordination", "client services", "care management"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
