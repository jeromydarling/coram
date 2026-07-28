
-- Add location fields to opportunities (organizations)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS state_fips text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS county_fips text,
  ADD COLUMN IF NOT EXISTS place_fips text,
  ADD COLUMN IF NOT EXISTS zip text;

-- Create org_neighborhood_insights table
CREATE TABLE public.org_neighborhood_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_key text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  fresh_until timestamptz NOT NULL,
  model text NOT NULL,
  summary text NOT NULL,
  insights_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, location_key)
);

CREATE INDEX idx_org_neighborhood_insights_org_id ON public.org_neighborhood_insights(org_id);
CREATE INDEX idx_org_neighborhood_insights_generated_at ON public.org_neighborhood_insights(generated_at);

ALTER TABLE public.org_neighborhood_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read neighborhood insights"
  ON public.org_neighborhood_insights FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert neighborhood insights"
  ON public.org_neighborhood_insights FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update their own insights"
  ON public.org_neighborhood_insights FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- Create org_neighborhood_insight_sources table
CREATE TABLE public.org_neighborhood_insight_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid NOT NULL REFERENCES public.org_neighborhood_insights(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  snippet text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL
);

CREATE INDEX idx_insight_sources_insight_id ON public.org_neighborhood_insight_sources(insight_id);

ALTER TABLE public.org_neighborhood_insight_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read insight sources"
  ON public.org_neighborhood_insight_sources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert insight sources"
  ON public.org_neighborhood_insight_sources FOR INSERT TO authenticated WITH CHECK (true);
