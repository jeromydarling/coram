
-- Phase 7R: Narrative Economy tables

-- 1. narrative_value_moments
CREATE TABLE public.narrative_value_moments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  opportunity_id uuid NULL,
  metro_id uuid NULL,
  source text NOT NULL CHECK (source IN ('impulsus','testimonium','signum','communio','journey','voluntarium','provisio')),
  moment_type text NOT NULL CHECK (moment_type IN ('growth','reconnection','community_presence','momentum','collaboration')),
  summary text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nvm_tenant_occurred ON public.narrative_value_moments (tenant_id, occurred_at DESC);
CREATE INDEX idx_nvm_moment_type ON public.narrative_value_moments (moment_type);

ALTER TABLE public.narrative_value_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users read own moments"
  ON public.narrative_value_moments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = narrative_value_moments.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Service role inserts moments"
  ON public.narrative_value_moments FOR INSERT
  WITH CHECK (true);

-- 2. narrative_story_drafts
CREATE TABLE public.narrative_story_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  outline jsonb NOT NULL DEFAULT '{}',
  sources jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'emerging' CHECK (status IN ('emerging','ready','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nsd_tenant ON public.narrative_story_drafts (tenant_id, status);

ALTER TABLE public.narrative_story_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users read own drafts"
  ON public.narrative_story_drafts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = narrative_story_drafts.tenant_id AND tu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Tenant users update own drafts"
  ON public.narrative_story_drafts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = narrative_story_drafts.tenant_id AND tu.user_id = auth.uid())
  );

CREATE POLICY "Service role inserts drafts"
  ON public.narrative_story_drafts FOR INSERT
  WITH CHECK (true);
