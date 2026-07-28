
-- F9: Grant Alignment / Fit Score table
CREATE TABLE public.grant_alignment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  rationale TEXT,
  run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, grant_id)
);

ALTER TABLE public.grant_alignment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view grant alignments"
  ON public.grant_alignment FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage grant alignments"
  ON public.grant_alignment FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_grant_alignment_org ON public.grant_alignment(org_id);
CREATE INDEX idx_grant_alignment_grant ON public.grant_alignment(grant_id);

-- F7: We'll query existing tables for graph data, no new tables needed
