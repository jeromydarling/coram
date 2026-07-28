-- Seed stripe_account_routing for CROS satellites
-- Generated 2026-07-27 for hub-and-spoke migration
-- Updated 2026-07-27 to omit refugium (dead code) and add missing satellites
-- NOTE: connected_account_id is a placeholder ('platform:<slug>') until real
-- Connect accounts are onboarded. This lets the hub route platform events by
-- metadata.satellite_app before any Connect activity exists.
--
-- IDEMPOTENT: on conflict (connected_account_id) do update to keep this SQL safe to re-run

-- ==== Supabase-hosted satellites (constructed URL via supabase_project_id + webhook_path) ====
insert into public.stripe_account_routing
  (connected_account_id, satellite_app, supabase_project_id, webhook_path, federation_secret_env, active)
values
  ('platform:resurrectio', 'resurrectio', 'lzincahqppvdeyzxqsqw', 'stripe-in', 'FEDERATION_STRIPE_SECRET_RESURRECTIO', true),
  ('platform:vigilia', 'vigilia', 'ephuuewoqemcnqjojoip', 'stripe-in', 'FEDERATION_STRIPE_SECRET_VIGILIA', true),
  ('platform:rehearso', 'rehearso', 'tidoerbzdomhtfyuovji', 'stripe-in', 'FEDERATION_STRIPE_SECRET_REHEARSO', true),
  ('platform:theschola', 'theschola', 'kpcannnhenymymnhpwib', 'stripe-in', 'FEDERATION_STRIPE_SECRET_THESCHOLA', true),
  ('platform:collegium', 'collegium', 'divzdyxtjhkbftsnffnu', 'stripe-in', 'FEDERATION_STRIPE_SECRET_COLLEGIUM', true),
  -- refugium omitted: Stripe code lives in supabase/functions.archive/ (dead code per 2026-07-27 audit).
  -- Re-add if refugium restores live payment surface.

  ('platform:bitoku', 'bitoku', 'oumbwqgibozyddwntstc', 'stripe-in', 'FEDERATION_STRIPE_SECRET_BITOKU', true),
  ('platform:communis', 'communis', 'ebsjikndtrtlvryphkgk', 'stripe-in', 'FEDERATION_STRIPE_SECRET_COMMUNIS', true),
  ('platform:fabrica', 'fabrica', 'wqnplepwcbbmtvajxnqx', 'stripe-in', 'FEDERATION_STRIPE_SECRET_FABRICA', true),
  ('platform:hortus', 'hortus', 'piaoyalquwfusbiedouq', 'stripe-in', 'FEDERATION_STRIPE_SECRET_HORTUS', true),
  ('platform:propria', 'propria', 'svmobotemmnsorkvlprb', 'stripe-in', 'FEDERATION_STRIPE_SECRET_PROPRIA', true),
  ('platform:transitus', 'transitus', 'jksfuzmyxgyjsrypxuxp', 'stripe-in', 'FEDERATION_STRIPE_SECRET_TRANSITUS', true),
  ('platform:thegreatnave', 'thegreatnave', 'betonqvgbnuqjeyutzqh', 'stripe-in', 'FEDERATION_STRIPE_SECRET_THEGREATNAVE', true),
  ('platform:cormundum', 'cormundum', 'lycubwceblanwyxfcojm', 'stripe-in', 'FEDERATION_STRIPE_SECRET_CORMUNDUM', true),
  ('platform:thecros', 'thecros', 'zmeawjhxbgvtcfcfcygf', 'stripe-webhook', 'FEDERATION_STRIPE_SECRET_THECROS', true)
on conflict (connected_account_id) do update set
  satellite_app = excluded.satellite_app,
  supabase_project_id = excluded.supabase_project_id,
  webhook_path = excluded.webhook_path,
  federation_secret_env = excluded.federation_secret_env,
  active = excluded.active,
  updated_at = now();

-- ==== Cloudflare-hosted satellites (target_url_override, active=false for now) ====
-- Rows are seeded so we have accurate metadata, but active=false because these
-- satellites currently accept Stripe's native signature format (stripe-signature),
-- not the CROS federation forwarding signature (X-CROS-Federation-Signature).
-- Migrating them requires satellite-side code changes to accept both formats.
-- Until then, Cloudflare satellites keep their direct Stripe webhook endpoints.
--
-- Requires migration 20260727215900_stripe_hub_target_url_override.sql for target_url_override column.
insert into public.stripe_account_routing
  (connected_account_id, satellite_app, supabase_project_id, webhook_path, federation_secret_env, target_url_override, active, notes)
values
  ('platform:sanctum',      'sanctum',      null, 'unused', 'FEDERATION_STRIPE_SECRET_SANCTUM',      'https://sanctum.garden/api/stripe/webhooks',   false, 'Cloudflare-hosted; still on direct Stripe endpoint'),
  ('platform:culina',       'culina',       null, 'unused', 'FEDERATION_STRIPE_SECRET_CULINA',       'https://culina.life/api/stripe/webhooks',      false, 'Cloudflare-hosted; still on direct Stripe endpoint'),
  ('platform:directio',     'directio',     null, 'unused', 'FEDERATION_STRIPE_SECRET_DIRECTIO',     'https://godirectio.com/api/stripe/webhook',    false, 'Cloudflare-hosted; still on direct Stripe endpoint'),
  ('platform:communicare',  'communicare',  null, 'unused', 'FEDERATION_STRIPE_SECRET_COMMUNICARE',  'https://communicare.farm/api/billing/webhook', false, 'Cloudflare-hosted; still on direct Stripe endpoint'),
  ('platform:8s',           '8s',           null, 'unused', 'FEDERATION_STRIPE_SECRET_8S',           'https://8s.rodeo/api/billing/webhook',         false, 'Cloudflare-hosted; still on direct Stripe endpoint')
  -- custodia not yet added: hasn't been published to custodia.land yet (todo #10).
on conflict (connected_account_id) do update set
  satellite_app = excluded.satellite_app,
  supabase_project_id = excluded.supabase_project_id,
  webhook_path = excluded.webhook_path,
  federation_secret_env = excluded.federation_secret_env,
  target_url_override = excluded.target_url_override,
  active = excluded.active,
  notes = excluded.notes,
  updated_at = now();
