-- Deprecate the homegrown operator error tracking infrastructure.
--
-- WHAT: The operator Error Desk now consumes Sentry as the source of truth for
--       platform errors. The operator_app_errors table and its upsert RPC are
--       retired. We keep the table (historical data) but stop writing to it, and
--       turn upsert_operator_error into a no-op so any lingering caller is harmless.
-- WHY:  Removes duplicate error-tracking infra; Sentry (cros-llc org) is canonical.

COMMENT ON TABLE public.operator_app_errors IS
  'DEPRECATED 2026-06-05: Error tracking migrated to Sentry (cros-llc org). '
  'No new rows are written. Retained for historical/archival reads only. '
  'Operator Error Desk now reads live from Sentry via the sentry-issues-proxy edge function.';

-- Replace the upsert with a no-op that preserves the exact original signature
-- (p_tenant_id uuid, p_source text, p_severity text, p_fingerprint text,
--  p_message text, p_context jsonb) RETURNS uuid.
CREATE OR REPLACE FUNCTION public.upsert_operator_error(
  p_tenant_id uuid,
  p_source text,
  p_severity text,
  p_fingerprint text,
  p_message text,
  p_context jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- DEPRECATED: operator_app_errors was retired in favor of Sentry.
  -- This function no longer writes anything and always returns NULL.
  RAISE NOTICE 'upsert_operator_error is deprecated; errors now flow to Sentry. No row written.';
  RETURN NULL;
END;
$$;
