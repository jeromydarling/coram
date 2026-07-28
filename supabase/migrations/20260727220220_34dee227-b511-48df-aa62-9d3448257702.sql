alter table public.stripe_account_routing
  add column if not exists target_url_override text;

alter table public.stripe_account_routing
  alter column supabase_project_id drop not null;

comment on column public.stripe_account_routing.target_url_override is
  'When set, forwarding uses this exact URL instead of https://<supabase_project_id>.supabase.co/functions/v1/<webhook_path>. Use for Cloudflare-hosted or custom-domain satellites.';