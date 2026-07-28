
-- org_watchlist_signals: deterministic signals emitted from watchlist diffs
CREATE TABLE IF NOT EXISTS public.org_watchlist_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  diff_id uuid REFERENCES public.org_snapshot_diffs(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES public.org_snapshots(id) ON DELETE CASCADE,
  signal_type text NOT NULL DEFAULT 'watchlist_change',
  summary text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.6,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique fingerprint to prevent duplicate signals
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_watchlist_signals_fingerprint ON public.org_watchlist_signals(fingerprint);

-- Lookup by org
CREATE INDEX IF NOT EXISTS idx_org_watchlist_signals_org_id ON public.org_watchlist_signals(org_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.org_watchlist_signals ENABLE ROW LEVEL SECURITY;

-- Service role inserts only (via ingest)
CREATE POLICY "Service role can insert watchlist signals"
  ON public.org_watchlist_signals FOR INSERT
  WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Authenticated users can read watchlist signals"
  ON public.org_watchlist_signals FOR SELECT
  USING (auth.role() = 'authenticated');

-- Add run_id column to org_snapshot_diffs for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'org_snapshot_diffs' AND column_name = 'run_id'
  ) THEN
    ALTER TABLE public.org_snapshot_diffs ADD COLUMN run_id text;
  END IF;
END $$;

-- Add unique constraint on org_snapshot_diffs(to_snapshot_id) to prevent duplicate diffs
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_snapshot_diffs_to_snapshot_unique ON public.org_snapshot_diffs(to_snapshot_id);

-- Add run_id column to org_snapshot_facts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'org_snapshot_facts' AND column_name = 'run_id'
  ) THEN
    ALTER TABLE public.org_snapshot_facts ADD COLUMN run_id text;
  END IF;
END $$;

-- Add run_id column to org_snapshots if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'org_snapshots' AND column_name = 'run_id'
  ) THEN
    ALTER TABLE public.org_snapshots ADD COLUMN run_id text;
  END IF;
END $$;
