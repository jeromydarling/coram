-- Stripe hub routing: support Cloudflare-hosted satellites via target_url_override.
-- Follow-up to 20260727115800_stripe_hub_routing.sql.
-- Original schema assumed all satellites at <project_id>.supabase.co/functions/v1/<path>.
-- Some CROS satellites (custodia, 8s, sanctum, culina, directio, communicare) are
-- Cloudflare-hosted with their own custom domains and routes. This column lets a row
-- provide a full URL that overrides the constructed Supabase URL.

alter table public.stripe_account_routing
  add column if not exists target_url_override text;

-- Make supabase_project_id + webhook_path optional now that override exists.
-- Keep the columns for backward compat and Supabase satellite convenience.
alter table public.stripe_account_routing
  alter column supabase_project_id drop not null;

comment on column public.stripe_account_routing.target_url_override is
  'When set, forwarding uses this exact URL instead of https://<supabase_project_id>.supabase.co/functions/v1/<webhook_path>. Use for Cloudflare-hosted or custom-domain satellites.';
