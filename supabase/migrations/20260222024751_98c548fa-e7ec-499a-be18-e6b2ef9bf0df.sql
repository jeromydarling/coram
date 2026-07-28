
-- Anonymized archetype signal rollups for Living Archetypes Engine
CREATE TABLE public.archetype_signal_rollups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  archetype_key text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  reflection_volume int NOT NULL DEFAULT 0,
  visit_activity int NOT NULL DEFAULT 0,
  event_presence int NOT NULL DEFAULT 0,
  momentum_growth int NOT NULL DEFAULT 0,
  tenant_sample_size int NOT NULL DEFAULT 0,
  generated_story text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (archetype_key, period_start)
);

-- RLS: public read, no tenant data exposed
ALTER TABLE public.archetype_signal_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read archetype signal rollups"
  ON public.archetype_signal_rollups FOR SELECT
  USING (true);

CREATE POLICY "Service role inserts archetype signal rollups"
  ON public.archetype_signal_rollups FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Service role updates archetype signal rollups"
  ON public.archetype_signal_rollups FOR UPDATE
  USING (false);

COMMENT ON TABLE public.archetype_signal_rollups IS 'Anonymized, aggregated narrative signals by archetype. Never contains tenant_id or identifiable data. Minimum sample size enforced by edge function.';
