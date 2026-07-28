
-- ============================================================
-- Phase 5A: Living Memory Layer tables
-- ============================================================

-- A) opportunity_memory_threads
CREATE TABLE public.opportunity_memory_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  window_start date NOT NULL,
  window_end date NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  memory_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_omt_opp_computed ON public.opportunity_memory_threads (opportunity_id, computed_at DESC);
CREATE UNIQUE INDEX idx_omt_opp_window ON public.opportunity_memory_threads (opportunity_id, window_start, window_end);

ALTER TABLE public.opportunity_memory_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "omt_select" ON public.opportunity_memory_threads FOR SELECT USING (
  public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'regional_lead'::app_role])
  OR public.has_metro_access(auth.uid(), (
    SELECT o.metro_id FROM public.opportunities o WHERE o.id = opportunity_memory_threads.opportunity_id
  ))
);

-- B) metro_memory_threads
CREATE TABLE public.metro_memory_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  window_start date NOT NULL,
  window_end date NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  memory_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mmt_metro_computed ON public.metro_memory_threads (metro_id, computed_at DESC);
CREATE UNIQUE INDEX idx_mmt_metro_window ON public.metro_memory_threads (metro_id, window_start, window_end);

ALTER TABLE public.metro_memory_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mmt_select" ON public.metro_memory_threads FOR SELECT USING (
  public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role, 'regional_lead'::app_role])
  OR public.has_metro_access(auth.uid(), metro_memory_threads.metro_id)
);

-- C) memory_email_drafts
CREATE TABLE public.memory_email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_med_user ON public.memory_email_drafts (user_id, created_at DESC);

ALTER TABLE public.memory_email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "med_select_own" ON public.memory_email_drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "med_insert_own" ON public.memory_email_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "med_delete_own" ON public.memory_email_drafts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "med_select_admin" ON public.memory_email_drafts FOR SELECT USING (
  public.has_any_role(auth.uid(), ARRAY['admin'::app_role])
);

-- updated_at triggers
CREATE TRIGGER update_omt_updated_at BEFORE UPDATE ON public.opportunity_memory_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mmt_updated_at BEFORE UPDATE ON public.metro_memory_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
