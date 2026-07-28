
-- ═══════════════════════════════════════════════════════════
-- Phase 3A: org_knowledge_profiles table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.org_knowledge_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_targeting_profile jsonb NOT NULL DEFAULT '{"preferred_event_types":[],"excluded_event_types":[],"audience_level":null,"attendance_mode":[]}'::jsonb,
  geo_reach_profile jsonb NOT NULL DEFAULT '{"primary_metros":[],"secondary_metros":[],"national_presence":false}'::jsonb,
  grant_alignment_vectors jsonb NOT NULL DEFAULT '{"focus_areas":[],"program_types":[]}'::jsonb,
  ecosystem_scope jsonb NOT NULL DEFAULT '{"sectors":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_knowledge_profiles_org_unique UNIQUE (organization_id)
);

-- Index for FK lookups
CREATE INDEX idx_org_knowledge_profiles_org_id ON public.org_knowledge_profiles(organization_id);

-- Auto-update updated_at
CREATE TRIGGER update_org_knowledge_profiles_updated_at
  BEFORE UPDATE ON public.org_knowledge_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- RLS — mirrors opportunities table access patterns
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.org_knowledge_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/leadership see all; regional_lead/staff scoped via org's metro
CREATE POLICY "Users can view org profiles in assigned metros"
  ON public.org_knowledge_profiles
  FOR SELECT
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR has_metro_access(auth.uid(), (
      SELECT metro_id FROM public.opportunities WHERE id = organization_id
    ))
  );

-- INSERT: admin/leadership only (service-role writes bypass RLS)
CREATE POLICY "Admins can create org profiles"
  ON public.org_knowledge_profiles
  FOR INSERT
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  );

-- UPDATE: admin/leadership only
CREATE POLICY "Admins can update org profiles"
  ON public.org_knowledge_profiles
  FOR UPDATE
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  );

-- DELETE: admin/leadership only
CREATE POLICY "Admins can delete org profiles"
  ON public.org_knowledge_profiles
  FOR DELETE
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  );
