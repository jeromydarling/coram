
-- =============================================
-- Saved Searches: tables, indexes, RLS, triggers
-- =============================================

-- 1) saved_searches
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('events', 'opportunities', 'grants')),
  scope text NOT NULL CHECK (scope IN ('metro', 'national')),
  metro_id uuid NULL REFERENCES public.metros(id),
  name text NOT NULL,
  raw_query text NOT NULL,
  enforced_query_template text NOT NULL,
  max_results int NOT NULL DEFAULT 20,
  last_run_id uuid NULL,
  last_ran_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_searches_user_created ON public.saved_searches (user_id, created_at DESC);
CREATE INDEX idx_saved_searches_user_module ON public.saved_searches (user_id, module);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own saved searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches"
  ON public.saved_searches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) saved_search_runs
CREATE TABLE public.saved_search_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  run_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_search_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own saved search runs"
  ON public.saved_search_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.saved_searches ss
    WHERE ss.id = saved_search_runs.saved_search_id
      AND ss.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own saved search runs"
  ON public.saved_search_runs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.saved_searches ss
    WHERE ss.id = saved_search_runs.saved_search_id
      AND ss.user_id = auth.uid()
  ));

-- 3) result_seen_urls
CREATE TABLE public.result_seen_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  url_normalized text NOT NULL,
  first_seen_run_id uuid NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(saved_search_id, url_normalized)
);

ALTER TABLE public.result_seen_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own result seen urls"
  ON public.result_seen_urls FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.saved_searches ss
    WHERE ss.id = result_seen_urls.saved_search_id
      AND ss.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own result seen urls"
  ON public.result_seen_urls FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.saved_searches ss
    WHERE ss.id = result_seen_urls.saved_search_id
      AND ss.user_id = auth.uid()
  ));
