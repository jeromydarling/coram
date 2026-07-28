-- Function to clean up old living system signals (older than 90 days)
CREATE OR REPLACE FUNCTION public.archive_old_living_signals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM living_system_signals
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
END;
$$;

-- Soft-delete snapshot triggers for living_system_signals and communio_public_profiles
-- living_system_signals doesn't have deleted_at so skip trigger, just add cleanup function above

-- Add deleted_at to communio_public_profiles if not present (safe idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'communio_public_profiles' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.communio_public_profiles ADD COLUMN deleted_at timestamptz DEFAULT NULL;
    ALTER TABLE public.communio_public_profiles ADD COLUMN deleted_by uuid DEFAULT NULL;
  END IF;
END $$;