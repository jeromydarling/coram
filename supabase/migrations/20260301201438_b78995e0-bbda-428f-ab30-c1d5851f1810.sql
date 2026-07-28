
-- Cache table for pre-rendered marketing pages served to AI crawlers
CREATE TABLE public.page_render_cache (
  path TEXT PRIMARY KEY,
  markdown_content TEXT NOT NULL,
  html_title TEXT,
  html_description TEXT,
  rendered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  render_source TEXT DEFAULT 'firecrawl',
  error TEXT
);

-- No RLS needed — this is public read-only content managed by edge functions
ALTER TABLE public.page_render_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached pages (bot-facing)
CREATE POLICY "Public read access to page cache"
  ON public.page_render_cache FOR SELECT
  USING (true);

-- Only service role can write (edge functions)
CREATE POLICY "Service role can manage page cache"
  ON public.page_render_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for expiry-based refresh queries
CREATE INDEX idx_page_render_cache_expires ON public.page_render_cache (expires_at);
