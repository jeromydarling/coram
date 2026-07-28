
-- ═══════════════════════════════════════════════
-- Phase 7Ω: Operator Feature Overrides + Announcements
-- ═══════════════════════════════════════════════

-- 1) operator_feature_overrides — Global kill switches
CREATE TABLE public.operator_feature_overrides (
  feature_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  set_by uuid REFERENCES auth.users(id),
  set_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read overrides"
  ON public.operator_feature_overrides FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin write overrides"
  ON public.operator_feature_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default override keys (all enabled = no kill)
INSERT INTO public.operator_feature_overrides (feature_key, enabled, reason) VALUES
  ('campaigns', true, 'Email campaign sending'),
  ('migrations', true, 'CRM migration imports'),
  ('communio_sharing', true, 'Cross-tenant sharing'),
  ('ai_suggestions', true, 'AI-powered suggestions')
ON CONFLICT DO NOTHING;

-- 2) operator_announcements — Platform-wide announcements
CREATE TABLE public.operator_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  active_until timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_announcements ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admin manage announcements"
  ON public.operator_announcements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read active announcements
CREATE POLICY "Users read active announcements"
  ON public.operator_announcements FOR SELECT
  TO authenticated
  USING (active_until IS NULL OR active_until > now());

-- 3) Extend operator_archetype_metrics with engagement columns
ALTER TABLE public.operator_archetype_metrics
  ADD COLUMN IF NOT EXISTS avg_impulsus_per_week numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_adoption_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drift_rate numeric DEFAULT 0;
