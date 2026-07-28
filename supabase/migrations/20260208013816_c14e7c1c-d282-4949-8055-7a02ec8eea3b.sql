
-- ══════════════════════════════════════════════════
-- Watchlist ingestion tables (Apollo-lite foundations)
-- ══════════════════════════════════════════════════

-- 1) org_watchlist — which orgs to crawl
CREATE TABLE public.org_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  website_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  cadence text NOT NULL DEFAULT 'weekly',
  tags jsonb DEFAULT '[]'::jsonb,
  last_crawled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_watchlist_org_id ON public.org_watchlist (org_id);
CREATE INDEX idx_org_watchlist_enabled ON public.org_watchlist (enabled) WHERE enabled = true;

ALTER TABLE public.org_watchlist ENABLE ROW LEVEL SECURITY;

-- Service-role only writes; authenticated reads
CREATE POLICY "Authenticated users can read watchlist"
  ON public.org_watchlist FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage watchlist"
  ON public.org_watchlist FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) org_snapshots — raw crawl results
CREATE TABLE public.org_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  run_id text,
  url text NOT NULL,
  crawled_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL,
  raw_text text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_snapshots_org_crawled ON public.org_snapshots (org_id, crawled_at DESC);
CREATE INDEX idx_org_snapshots_run_id ON public.org_snapshots (run_id);

ALTER TABLE public.org_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshots"
  ON public.org_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage snapshots"
  ON public.org_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) org_snapshot_facts — AI-extracted facts from a snapshot
CREATE TABLE public.org_snapshot_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  snapshot_id uuid NOT NULL REFERENCES public.org_snapshots(id) ON DELETE CASCADE,
  run_id text,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_snapshot_facts_org ON public.org_snapshot_facts (org_id);
CREATE INDEX idx_org_snapshot_facts_snapshot ON public.org_snapshot_facts (snapshot_id);

ALTER TABLE public.org_snapshot_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshot facts"
  ON public.org_snapshot_facts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage snapshot facts"
  ON public.org_snapshot_facts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) org_snapshot_diffs — diffs between consecutive snapshots
CREATE TABLE public.org_snapshot_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  from_snapshot_id uuid NOT NULL REFERENCES public.org_snapshots(id) ON DELETE CASCADE,
  to_snapshot_id uuid NOT NULL REFERENCES public.org_snapshots(id) ON DELETE CASCADE,
  run_id text,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_snapshot_diffs_org ON public.org_snapshot_diffs (org_id);
CREATE INDEX idx_org_snapshot_diffs_to ON public.org_snapshot_diffs (to_snapshot_id);

ALTER TABLE public.org_snapshot_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshot diffs"
  ON public.org_snapshot_diffs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage snapshot diffs"
  ON public.org_snapshot_diffs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at trigger for org_watchlist
CREATE TRIGGER update_org_watchlist_updated_at
  BEFORE UPDATE ON public.org_watchlist
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
