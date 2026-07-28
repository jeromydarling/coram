
-- Add signal_fingerprint column
ALTER TABLE public.opportunity_signals
ADD COLUMN signal_fingerprint text;

-- Add unique index for deduplication
CREATE UNIQUE INDEX idx_opportunity_signals_run_fingerprint
ON public.opportunity_signals (run_id, signal_fingerprint)
WHERE signal_fingerprint IS NOT NULL;
