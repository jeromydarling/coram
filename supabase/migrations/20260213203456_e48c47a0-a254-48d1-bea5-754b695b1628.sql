
-- ================================================================
-- Phase 3C: Replace COALESCE sentinel unique index with two
-- partial unique indexes + LENIENT CHECK constraint
-- ================================================================
-- DATA AUDIT (table is empty, all counts = 0):
--   both_set:  0
--   both_null: 0
--   metro dupes: 0
--   opp dupes:   0
--   total rows:  0
-- No cleanup needed.
-- ================================================================

-- Step D: Drop the existing COALESCE/sentinel unique index
DROP INDEX IF EXISTS public.idx_discovery_item_links_unique;

-- Step E: Create two partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS discovery_item_links_unique_metro
  ON public.discovery_item_links (discovered_item_id, metro_id)
  WHERE metro_id IS NOT NULL AND opportunity_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_item_links_unique_opportunity
  ON public.discovery_item_links (discovered_item_id, opportunity_id)
  WHERE opportunity_id IS NOT NULL AND metro_id IS NULL;

-- Step F: LENIENT CHECK — disallow both-set, allow both-null
-- Chosen LENIENT because the partial indexes already exclude both-null
-- rows from uniqueness enforcement, so they're harmless. Strict XOR
-- would break if a future use case needs unscoped rows.
ALTER TABLE public.discovery_item_links
  ADD CONSTRAINT discovery_item_links_scope_xor_chk
  CHECK (NOT (metro_id IS NOT NULL AND opportunity_id IS NOT NULL));
