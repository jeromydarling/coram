-- Stripe hub routing + idempotency + DLQ tables
-- Supports stripe-hub-connect and stripe-hub-platform edge functions
-- Migration created 2026-07-27 as part of the 32-endpoint consolidation plan

-- Routing table: connected_account_id -> satellite app
create table if not exists public.stripe_account_routing (
  connected_account_id text primary key,
  satellite_app text not null,
  supabase_project_id text not null,
  webhook_path text not null default 'stripe-in',
  federation_secret_env text not null,
  tenant_id uuid,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stripe_account_routing_satellite_idx
  on public.stripe_account_routing (satellite_app);
create index if not exists stripe_account_routing_active_idx
  on public.stripe_account_routing (active) where active = true;

-- Platform checkout / customer routing (for events without event.account)
create table if not exists public.stripe_checkout_routing (
  stripe_customer_id text primary key,
  satellite_app text not null,
  supabase_project_id text not null,
  tenant_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists stripe_checkout_routing_satellite_idx
  on public.stripe_checkout_routing (satellite_app);

-- Idempotency + audit log for hub deliveries
create table if not exists public.stripe_hub_events (
  event_id text primary key,
  event_type text not null,
  connected_account_id text,
  satellite_app text,
  routed_at timestamptz not null default now(),
  forwarded_status_code int,
  forwarded_response text,
  processed_ok boolean not null default false
);
create index if not exists stripe_hub_events_type_idx
  on public.stripe_hub_events (event_type);
create index if not exists stripe_hub_events_satellite_idx
  on public.stripe_hub_events (satellite_app);
create index if not exists stripe_hub_events_routed_at_idx
  on public.stripe_hub_events (routed_at desc);

-- Dead-letter queue for downstream failures + unknown routes
create table if not exists public.stripe_hub_dlq (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_type text not null,
  connected_account_id text,
  target_url text,
  failure_reason text,
  event_payload jsonb,
  retry_count int not null default 0,
  next_retry_at timestamptz,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists stripe_hub_dlq_pending_idx
  on public.stripe_hub_dlq (next_retry_at) where resolved = false;
create index if not exists stripe_hub_dlq_event_idx
  on public.stripe_hub_dlq (event_id);

-- RLS: service role only. Tables are internal to the hub.
alter table public.stripe_account_routing enable row level security;
alter table public.stripe_checkout_routing enable row level security;
alter table public.stripe_hub_events enable row level security;
alter table public.stripe_hub_dlq enable row level security;

-- No permissive policies added; service role bypasses RLS in the hub edge fn.
-- Ensures no anon/authenticated client can read/write these tables directly.

comment on table public.stripe_account_routing is
  'Routes Stripe Connect events to satellite apps by connected account ID.';
comment on table public.stripe_checkout_routing is
  'Routes platform-level Stripe events to satellite apps by Stripe customer ID.';
comment on table public.stripe_hub_events is
  'Idempotency + audit log for events processed by stripe-hub-* edge functions.';
comment on table public.stripe_hub_dlq is
  'Dead-letter queue for hub deliveries that failed downstream.';
