# Claude Code Task: Seed thecros Routing Table

If Task 3 in the main federation-secrets prompt was skipped (or if you want to do it independently), here's the standalone version:

## Steps

1. Open the Supabase project `zmeawjhxbgvtcfcfcygf` (thecros).
2. Run the SQL in `sql/thecros_stripe_routing_seed.sql` via Supabase MCP.
3. Verify with:
   ```sql
   select
     count(*) filter (where active=true) as active_rows,
     count(*) filter (where active=false) as inactive_rows,
     count(*) as total
   from public.stripe_account_routing;
   ```
   Expected: `active_rows=15, inactive_rows=5, total=20`.

## What the SQL does

Two blocks:

**Block 1 (Supabase-hosted, 15 rows, active=true):**
- Each row maps a `connected_account_id='platform:<slug>'` placeholder to a satellite's Supabase project ID and webhook path.
- Placeholder Connect IDs will be replaced with real `acct_*` IDs when actual Connect accounts are onboarded — the placeholders let platform-mode events route by metadata alone in the meantime.

**Block 2 (Cloudflare-hosted, 5 rows, active=false):**
- Uses `target_url_override` column (added by migration `20260727215900_stripe_hub_target_url_override.sql`).
- `active=false` because migrating these requires satellite code changes (they still consume Stripe's native `stripe-signature`, not the CROS federation forwarding signature).
- Custodia not included — not yet published to `custodia.land`.

## Idempotency

The SQL uses `on conflict (connected_account_id) do update` — safe to re-run without duplicating rows. Re-running will refresh `updated_at`.

## Precondition check

Before running, confirm the schema has the `target_url_override` column:

```sql
select column_name from information_schema.columns
where table_name='stripe_account_routing'
  and column_name='target_url_override';
```

If this returns 0 rows, migration `20260727215900_stripe_hub_target_url_override.sql` didn't apply. It should have been applied automatically when the Lovable project synced from GitHub, but if not, run that migration first.
