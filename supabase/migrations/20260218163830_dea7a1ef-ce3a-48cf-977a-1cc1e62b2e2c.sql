
-- Metro news sources: tracks URLs that feed the metro narrative pipeline
-- Sources can be auto-discovered by n8n or manually added by admins/regional leads
CREATE TABLE public.metro_news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  source_origin text NOT NULL DEFAULT 'manual' CHECK (source_origin IN ('auto_discovered', 'manual')),
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_crawled_at timestamptz,
  last_status text CHECK (last_status IS NULL OR last_status IN ('ok', 'warning', 'error')),
  last_error text,
  detected_feed_type text CHECK (detected_feed_type IS NULL OR detected_feed_type IN ('rss', 'html', 'unknown')),
  failure_count integer NOT NULL DEFAULT 0,
  auto_disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metro_id, url)
);

-- Indexes
CREATE INDEX idx_metro_news_sources_metro ON public.metro_news_sources(metro_id);
CREATE INDEX idx_metro_news_sources_enabled ON public.metro_news_sources(enabled) WHERE enabled = true;
CREATE INDEX idx_metro_news_sources_origin ON public.metro_news_sources(source_origin);

-- Auto-update updated_at
CREATE TRIGGER set_metro_news_sources_updated_at
  BEFORE UPDATE ON public.metro_news_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-disable after 3 consecutive failures (reuse same pattern as local_pulse_sources)
CREATE OR REPLACE FUNCTION public.metro_news_source_record_failure(p_source_id uuid, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
BEGIN
  UPDATE metro_news_sources
  SET failure_count = failure_count + 1,
      last_error = COALESCE(p_error, last_error),
      last_status = 'error',
      updated_at = now()
  WHERE id = p_source_id
  RETURNING failure_count INTO v_new_count;

  IF v_new_count >= 3 THEN
    UPDATE metro_news_sources
    SET auto_disabled = true, enabled = false
    WHERE id = p_source_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.metro_news_source_record_success(p_source_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE metro_news_sources
  SET failure_count = 0,
      last_status = 'ok',
      last_crawled_at = now(),
      auto_disabled = false,
      updated_at = now()
  WHERE id = p_source_id;
END;
$$;

-- RLS
ALTER TABLE public.metro_news_sources ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users with metro access can read
CREATE POLICY "metro_news_sources_select"
ON public.metro_news_sources FOR SELECT TO authenticated
USING (public.has_metro_access(auth.uid(), metro_id));

-- INSERT: admin, leadership, regional_lead
CREATE POLICY "metro_news_sources_insert"
ON public.metro_news_sources FOR INSERT TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['admin', 'leadership', 'regional_lead']::app_role[])
  AND public.has_metro_access(auth.uid(), metro_id)
);

-- UPDATE: admin, leadership, regional_lead with metro access
CREATE POLICY "metro_news_sources_update"
ON public.metro_news_sources FOR UPDATE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin', 'leadership', 'regional_lead']::app_role[])
  AND public.has_metro_access(auth.uid(), metro_id)
);

-- DELETE: admin, leadership, regional_lead with metro access
CREATE POLICY "metro_news_sources_delete"
ON public.metro_news_sources FOR DELETE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin', 'leadership', 'regional_lead']::app_role[])
  AND public.has_metro_access(auth.uid(), metro_id)
);

-- Service-role bypass for n8n auto-discovery (edge functions use service role)
-- No additional policy needed; service role bypasses RLS.
