
-- Fix org_snapshots: add unique constraint, make raw_text + meta NOT NULL
ALTER TABLE public.org_snapshots ALTER COLUMN raw_text SET NOT NULL;
ALTER TABLE public.org_snapshots ALTER COLUMN raw_text SET DEFAULT '';
ALTER TABLE public.org_snapshots ALTER COLUMN meta SET NOT NULL;
ALTER TABLE public.org_snapshots ALTER COLUMN meta SET DEFAULT '{}'::jsonb;
ALTER TABLE public.org_snapshots ADD CONSTRAINT uq_org_snapshots_org_hash UNIQUE (org_id, content_hash);

-- Fix org_snapshot_diffs: make from_snapshot_id nullable (was NOT NULL)
ALTER TABLE public.org_snapshot_diffs ALTER COLUMN from_snapshot_id DROP NOT NULL;

-- Fix org_watchlist.tags default from '[]' to '{}'
ALTER TABLE public.org_watchlist ALTER COLUMN tags SET DEFAULT '{}'::jsonb;
ALTER TABLE public.org_watchlist ALTER COLUMN tags SET NOT NULL;

-- Add missing composite index on org_watchlist(enabled, cadence)
DROP INDEX IF EXISTS idx_org_watchlist_enabled;
CREATE INDEX idx_org_watchlist_enabled_cadence ON public.org_watchlist (enabled, cadence);

-- Add missing indexes on org_snapshot_facts and org_snapshot_diffs
CREATE INDEX IF NOT EXISTS idx_org_snapshot_facts_org_created ON public.org_snapshot_facts (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_snapshot_diffs_org_created ON public.org_snapshot_diffs (org_id, created_at DESC);
