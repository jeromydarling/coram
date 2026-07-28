
-- =========================================================
-- Phase 4B Stabilization: reflection_extractions, email_story_signals, relationship_suggestions
-- =========================================================

-- 1) reflection_extractions — one extraction per reflection
CREATE TABLE public.reflection_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id uuid NOT NULL UNIQUE REFERENCES public.opportunity_reflections(id) ON DELETE CASCADE,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  relationship_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  sentiment text,
  confidence numeric,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reflection_extractions_reflection ON public.reflection_extractions(reflection_id);

ALTER TABLE public.reflection_extractions ENABLE ROW LEVEL SECURITY;

-- Service role writes; authenticated users read via opportunity access
CREATE POLICY "Authenticated users can read reflection extractions"
  ON public.reflection_extractions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunity_reflections r
      JOIN public.opportunities o ON o.id = r.opportunity_id
      WHERE r.id = reflection_extractions.reflection_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- 2) email_story_signals — one signal per email message
CREATE TABLE public.email_story_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id uuid NOT NULL UNIQUE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_story_signals_opp ON public.email_story_signals(opportunity_id, created_at DESC);

ALTER TABLE public.email_story_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email story signals"
  ON public.email_story_signals FOR SELECT TO authenticated
  USING (
    opportunity_id IS NULL OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = email_story_signals.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );

-- 3) relationship_suggestions — gentle suggestion engine
CREATE TABLE public.relationship_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('reflection', 'email', 'metro')),
  suggestion_type text NOT NULL,
  summary text NOT NULL,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_relationship_suggestions_opp ON public.relationship_suggestions(opportunity_id, created_at DESC);

ALTER TABLE public.relationship_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read relationship suggestions"
  ON public.relationship_suggestions FOR SELECT TO authenticated
  USING (
    opportunity_id IS NULL OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = relationship_suggestions.opportunity_id
        AND public.has_metro_access(auth.uid(), o.metro_id)
    )
  );
