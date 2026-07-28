-- Federation Phase 2 — Publishing (Hub side)
--
-- WHAT: Extends library_essays so the hub knows which satellite each essay should be published to,
--       and tracks whether the published version has been synced over to that satellite's DB.
-- WHY:  thecros is the editorial hub. Approved essays for vigilia/resurrectio get composed here,
--       then pushed to the satellite for rendering on its public /library pages.
-- HOW:  Purely additive — adds two columns + an index. No data migration, no destructive changes.
-- IDEMPOTENT: safe to re-run.

BEGIN;

-- 1) target_app — which satellite this essay is destined for. Default 'thecros' so existing essays don't change behavior.
ALTER TABLE public.library_essays
  ADD COLUMN IF NOT EXISTS target_app text NOT NULL DEFAULT 'thecros';

-- Constrain to known apps. Satellites that don't exist yet just won't show as options in the UI.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'library_essays_target_app_chk'
      AND conrelid = 'public.library_essays'::regclass
  ) THEN
    ALTER TABLE public.library_essays
      ADD CONSTRAINT library_essays_target_app_chk
      CHECK (target_app IN ('thecros','vigilia','resurrectio','hortus','communis','transitus','bitoku'));
  END IF;
END$$;

-- 2) synced_to_satellite_at — null until the publish-to-satellite edge function has successfully delivered.
ALTER TABLE public.library_essays
  ADD COLUMN IF NOT EXISTS synced_to_satellite_at timestamptz;

-- 3) sync_error — last error message from a failed sync attempt, for visibility in the studio UI.
ALTER TABLE public.library_essays
  ADD COLUMN IF NOT EXISTS sync_error text;

-- Index for the publish-to-satellite worker: "give me everything that's published, has a non-thecros target,
-- and hasn't been synced yet."
CREATE INDEX IF NOT EXISTS idx_library_essays_pending_satellite_sync
  ON public.library_essays (target_app, status, synced_to_satellite_at)
  WHERE target_app <> 'thecros'
    AND status = 'published'
    AND synced_to_satellite_at IS NULL;

COMMIT;
