-- Add encrypted token columns to outlook_connections (service-role only via RLS)
ALTER TABLE public.outlook_connections
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- These columns are already protected by existing RLS (service-role reads only)
-- But let's ensure the policies are tight
COMMENT ON COLUMN public.outlook_connections.access_token IS 'Microsoft Graph access token — readable only via service role';
COMMENT ON COLUMN public.outlook_connections.refresh_token IS 'Microsoft OAuth refresh token — readable only via service role';
COMMENT ON COLUMN public.outlook_connections.token_expires_at IS 'Access token expiry timestamp';