
-- ═══════════════════════════════════════════════════════
-- Enrichment job queue tables + atomic lease RPC
-- ═══════════════════════════════════════════════════════

-- 1) enrichment_jobs
CREATE TABLE public.enrichment_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE,
  entity_type text NOT NULL CHECK (entity_type IN ('event', 'opportunity', 'grant')),
  entity_id uuid NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'leased', 'completed', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  leased_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
-- No policies: client access denied; edge functions use service role

CREATE INDEX idx_enrichment_jobs_status_created ON public.enrichment_jobs (status, created_at);
CREATE INDEX idx_enrichment_jobs_entity ON public.enrichment_jobs (entity_type, entity_id);

CREATE TRIGGER update_enrichment_jobs_updated_at
  BEFORE UPDATE ON public.enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) enrichment_results
CREATE TABLE public.enrichment_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE,
  workflow text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'no_data')),
  entity_type text NOT NULL CHECK (entity_type IN ('event', 'opportunity', 'grant')),
  entity_id uuid NOT NULL,
  source_url text NOT NULL,
  scrape_ok boolean NOT NULL,
  scrape_bytes int NOT NULL DEFAULT 0,
  enrichment jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_results ENABLE ROW LEVEL SECURITY;
-- No policies: client access denied; edge functions use service role

CREATE INDEX idx_enrichment_results_entity ON public.enrichment_results (entity_type, entity_id);

-- 3) Atomic job lease RPC
CREATE OR REPLACE FUNCTION public.enrichment_job_next(
  p_lease_seconds int,
  p_worker_id text,
  p_max_attempts int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job enrichment_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job
  FROM enrichment_jobs
  WHERE (status = 'queued' OR (status = 'leased' AND lease_expires_at < now()))
    AND attempts < p_max_attempts
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE enrichment_jobs
  SET status = 'leased',
      attempts = attempts + 1,
      lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
      leased_by = p_worker_id
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'run_id', v_job.run_id,
    'entity_type', v_job.entity_type,
    'entity_id', v_job.entity_id,
    'source_url', v_job.source_url,
    'attempts', v_job.attempts + 1
  );
END;
$$;

-- Revoke public access to the RPC
REVOKE ALL ON FUNCTION public.enrichment_job_next(int, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enrichment_job_next(int, text, int) FROM anon;
REVOKE ALL ON FUNCTION public.enrichment_job_next(int, text, int) FROM authenticated;
