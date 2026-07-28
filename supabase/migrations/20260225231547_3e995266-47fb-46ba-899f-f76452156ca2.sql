
-- ══════════════════════════════════════════════════════
-- GARDENER STUDIO — Phase 21Z Schema
-- ══════════════════════════════════════════════════════

-- 1) Gardener Audit Log
CREATE TABLE public.gardener_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  diff_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gardener_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gardener audit log: admin read"
  ON public.gardener_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Gardener audit log: admin insert"
  ON public.gardener_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_gardener_audit_entity ON public.gardener_audit_log(entity_type, entity_id);
CREATE INDEX idx_gardener_audit_created ON public.gardener_audit_log(created_at DESC);

-- 2) Voice Calibration Profiles
CREATE TABLE public.voice_calibration_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  sector text NOT NULL DEFAULT 'general',
  do_rules text[] NOT NULL DEFAULT '{}',
  dont_rules text[] NOT NULL DEFAULT '{}',
  tone_description text,
  ignatian_mode boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_calibration_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voice profiles: admin read"
  ON public.voice_calibration_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Voice profiles: admin write"
  ON public.voice_calibration_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Voice Calibration Examples (before → after)
CREATE TABLE public.voice_calibration_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.voice_calibration_profiles(id) ON DELETE CASCADE,
  before_text text NOT NULL,
  after_text text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_calibration_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voice examples: admin read"
  ON public.voice_calibration_examples FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Voice examples: admin write"
  ON public.voice_calibration_examples FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Editor AI Suggestions (draft patches with acceptance flow)
CREATE TABLE public.editor_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  original_version_id text,
  prompt_type text NOT NULL,
  proposed_patch_json jsonb NOT NULL,
  reasoning_text text,
  ai_model text DEFAULT 'google/gemini-2.5-flash',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid,
  rejected_at timestamptz
);
ALTER TABLE public.editor_ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI suggestions: admin read"
  ON public.editor_ai_suggestions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "AI suggestions: admin insert"
  ON public.editor_ai_suggestions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "AI suggestions: admin update"
  ON public.editor_ai_suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Gardener Feature Flags (small bounded set)
CREATE TABLE public.gardener_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  display_name text NOT NULL,
  description text,
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gardener_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gardener flags: admin read"
  ON public.gardener_feature_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Gardener flags: admin write"
  ON public.gardener_feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default feature flags
INSERT INTO public.gardener_feature_flags (key, display_name, description, enabled) VALUES
  ('seed_simulation_engine', 'Seed Simulation Engine', 'Enable archetype simulation engine for testing tenant behavior patterns.', false),
  ('rss_essay_ingestion', 'RSS Essay Ingestion', 'Enable automated RSS feed ingestion for Living Library essay generation.', true),
  ('familia_suggestions', 'Familia Suggestions', 'Enable NRI-driven Familia kinship suggestions during onboarding.', true),
  ('communio_public_directory', 'Communio Public Directory', 'Allow tenants to appear in the Communio public discovery directory.', true),
  ('living_pulse_digests', 'Living Pulse Digests', 'Enable automated narrative digest email delivery to users.', false),
  ('voice_calibration', 'Voice Calibration', 'Enable NRI voice calibration for essay and playbook generation.', true);

-- Seed default voice calibration profile
INSERT INTO public.voice_calibration_profiles (profile_key, display_name, sector, tone_description, do_rules, dont_rules) VALUES
  ('cros_default', 'CROS Default', 'general',
   'Calm, pastoral, human-centered. Ignatian discernment rhythm: Noticing → Reflection → Insight → Invitation.',
   ARRAY['Use gentle, invitational language', 'Lead with story before data', 'Preserve dignity of every person mentioned', 'Use "we noticed" not "alert"', 'Include reflection prompts'],
   ARRAY['Never use urgency language', 'Avoid corporate jargon (KPIs, funnels, conversions)', 'No hype or exaggeration', 'Do not change theological stance', 'Avoid "optimize" or "boost"']
  ),
  ('catholic_outreach', 'Catholic Outreach', 'catholic',
   'Rooted in Catholic social teaching. Ignatian spirituality. Consolation over alarm.',
   ARRAY['Reference Ignatian principles naturally', 'Use liturgical season awareness', 'Honor parish and diocesan language', 'Prefer "accompaniment" over "engagement"'],
   ARRAY['Never trivialize sacramental language', 'Avoid Protestant evangelical tone', 'Do not use marketing superlatives']
  ),
  ('nonprofit_general', 'Nonprofit General', 'nonprofit',
   'Mission-first, community-centered. Warm and professional without being corporate.',
   ARRAY['Center the people being served', 'Use impact language grounded in stories', 'Acknowledge complexity'],
   ARRAY['Avoid donor-centric framing', 'No poverty tourism language', 'Do not reduce people to statistics']
  );
