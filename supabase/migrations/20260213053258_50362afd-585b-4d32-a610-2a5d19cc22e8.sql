
-- Grant resources: stores links, dates, downloads, and other extracted metadata per grant
CREATE TABLE public.grant_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'link', 'date', 'download', 'contact'
  label TEXT NOT NULL,
  url TEXT,
  resource_date DATE,
  resource_date_end DATE,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'regex', -- 'regex', 'llm', 'manual'
  run_id TEXT, -- links back to enrichment run
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by grant
CREATE INDEX idx_grant_resources_grant_id ON public.grant_resources(grant_id);

-- Index for deduplication by grant + url
CREATE UNIQUE INDEX idx_grant_resources_dedup ON public.grant_resources(grant_id, resource_type, url) WHERE url IS NOT NULL;

-- Index for deduplication by grant + label + date (for date-type resources)
CREATE UNIQUE INDEX idx_grant_resources_date_dedup ON public.grant_resources(grant_id, resource_type, label, resource_date) WHERE resource_date IS NOT NULL AND url IS NULL;

-- Updated_at trigger
CREATE TRIGGER set_grant_resources_updated_at
  BEFORE UPDATE ON public.grant_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.grant_resources ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all grant resources (same access as grants)
CREATE POLICY "Authenticated users can read grant resources"
  ON public.grant_resources FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admin/rim roles can insert (service role bypasses for edge functions)
CREATE POLICY "Authenticated users can insert grant resources"
  ON public.grant_resources FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Update policy
CREATE POLICY "Authenticated users can update grant resources"
  ON public.grant_resources FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Delete policy
CREATE POLICY "Authenticated users can delete grant resources"
  ON public.grant_resources FOR DELETE
  USING (auth.role() = 'authenticated');
