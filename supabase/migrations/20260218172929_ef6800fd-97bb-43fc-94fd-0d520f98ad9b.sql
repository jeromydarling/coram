
-- ════════════════════════════════════════════════════════════
-- PART 1: Dedicated metro_news_runs table for rich ingestion metrics
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.metro_news_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid NOT NULL REFERENCES metros(id) ON DELETE CASCADE,
  period_start date NULL,
  period_end date NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  queries_used jsonb NOT NULL DEFAULT '[]',
  keyword_snapshot jsonb NOT NULL DEFAULT '[]',
  source_count int NOT NULL DEFAULT 0,
  articles_found int NOT NULL DEFAULT 0,
  articles_deduped int NOT NULL DEFAULT 0,
  articles_persisted int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]',
  duration_ms int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_metro_news_runs_metro_ran ON metro_news_runs (metro_id, ran_at DESC);
CREATE INDEX idx_metro_news_runs_status_ran ON metro_news_runs (status, ran_at DESC);

-- RLS
ALTER TABLE metro_news_runs ENABLE ROW LEVEL SECURITY;

-- SELECT: metro access + admin/leadership/regional_lead
CREATE POLICY "metro_news_runs_select" ON metro_news_runs
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR public.has_metro_access(auth.uid(), metro_id)
  );

-- INSERT/UPDATE: service-role only (no user policy needed — edge functions use service role)
-- No INSERT/UPDATE policies for regular users

-- updated_at trigger
CREATE TRIGGER set_metro_news_runs_updated_at
  BEFORE UPDATE ON metro_news_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════
-- PART 2: Extend metro_narratives with news impact metrics
-- ════════════════════════════════════════════════════════════

ALTER TABLE metro_narratives
  ADD COLUMN IF NOT EXISTS news_run_id uuid NULL REFERENCES metro_news_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS news_items_used_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS news_topics_used_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS news_signal_strength int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inputs_summary jsonb NOT NULL DEFAULT '{}';

-- Validate signal strength 0-100
CREATE OR REPLACE FUNCTION public.validate_news_signal_strength()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.news_signal_strength < 0 THEN NEW.news_signal_strength := 0; END IF;
  IF NEW.news_signal_strength > 100 THEN NEW.news_signal_strength := 100; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_metro_narratives_signal_strength
  BEFORE INSERT OR UPDATE ON metro_narratives
  FOR EACH ROW EXECUTE FUNCTION public.validate_news_signal_strength();
