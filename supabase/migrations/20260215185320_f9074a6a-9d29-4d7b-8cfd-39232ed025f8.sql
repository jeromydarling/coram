
-- Metro Narrative Snapshots: stores topic/signal counts per metro per period
CREATE TABLE public.metro_narrative_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  narrative_version int NOT NULL DEFAULT 1,
  narrative_hash text NOT NULL,
  topic_counts jsonb NOT NULL DEFAULT '{}',
  signal_counts jsonb NOT NULL DEFAULT '{}',
  source_mix jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metro_id, period_start, period_end)
);

-- Metro Narrative Drifts: computed drift between consecutive snapshots
CREATE TABLE public.metro_narrative_drifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  current_snapshot_id uuid NOT NULL REFERENCES public.metro_narrative_snapshots(id) ON DELETE CASCADE,
  previous_snapshot_id uuid NULL REFERENCES public.metro_narrative_snapshots(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  drift_score int NOT NULL DEFAULT 0,
  emerging_topics jsonb NOT NULL DEFAULT '[]',
  fading_topics jsonb NOT NULL DEFAULT '[]',
  accelerating_topics jsonb NOT NULL DEFAULT '[]',
  stable_themes jsonb NOT NULL DEFAULT '[]',
  divergence jsonb NOT NULL DEFAULT '{}',
  summary_md text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for drift_score bounds (instead of CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_drift_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.drift_score < 0 THEN NEW.drift_score := 0; END IF;
  IF NEW.drift_score > 100 THEN NEW.drift_score := 100; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_drift_score_trigger
BEFORE INSERT OR UPDATE ON public.metro_narrative_drifts
FOR EACH ROW EXECUTE FUNCTION public.validate_drift_score();

-- Indexes for efficient querying
CREATE INDEX idx_narrative_drifts_metro_created ON public.metro_narrative_drifts (metro_id, created_at DESC);
CREATE INDEX idx_narrative_drifts_metro_period ON public.metro_narrative_drifts (metro_id, period_start DESC);
CREATE INDEX idx_narrative_snapshots_metro_period ON public.metro_narrative_snapshots (metro_id, period_start DESC);

-- RLS: metro_narrative_snapshots
ALTER TABLE public.metro_narrative_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read snapshots for accessible metros"
ON public.metro_narrative_snapshots
FOR SELECT
USING (public.has_metro_access(auth.uid(), metro_id));

-- No insert/update/delete for regular users — service-role only

-- RLS: metro_narrative_drifts
ALTER TABLE public.metro_narrative_drifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read drifts for accessible metros"
ON public.metro_narrative_drifts
FOR SELECT
USING (public.has_metro_access(auth.uid(), metro_id));

-- No insert/update/delete for regular users — service-role only
