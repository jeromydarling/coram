
-- ═══════════════════════════════════════════════════════════
-- Phase 5A: narrative_partner_suggestions
-- Calm, story-driven relationship check-in suggestions
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.narrative_partner_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  narrative_id uuid NOT NULL REFERENCES public.metro_narratives(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('check_in', 'offer_support', 'introduce_partner', 'share_resource')),
  reasoning text NOT NULL,
  ai_confidence integer NOT NULL DEFAULT 50 CHECK (ai_confidence BETWEEN 0 AND 100),
  suggested_message_md text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed boolean NOT NULL DEFAULT false,
  -- Deterministic dedupe: one suggestion per type per org per narrative
  CONSTRAINT narrative_partner_suggestions_dedupe UNIQUE (narrative_id, opportunity_id, suggestion_type)
);

-- Indexes
CREATE INDEX idx_nps_metro_created ON public.narrative_partner_suggestions(metro_id, created_at DESC);
CREATE INDEX idx_nps_opportunity_created ON public.narrative_partner_suggestions(opportunity_id, created_at DESC);

-- RLS
ALTER TABLE public.narrative_partner_suggestions ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/leadership see all; metro-scoped users see their metros
CREATE POLICY "Users can view partner suggestions for assigned metros"
  ON public.narrative_partner_suggestions
  FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::public.app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- UPDATE (dismiss only): same access as SELECT
CREATE POLICY "Users can dismiss partner suggestions for assigned metros"
  ON public.narrative_partner_suggestions
  FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::public.app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- INSERT/DELETE: service role only (no user-facing policy needed)
