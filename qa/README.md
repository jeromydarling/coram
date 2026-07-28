# QA Scripts & Test Runner Reference

## Test Matrix

| Layer | Tool | Command | Runs in CI? |
|-------|------|---------|-------------|
| **Edge Functions (Deno)** | Deno test runner | Lovable Deno test tool | ✅ Automated |
| **Frontend (TypeScript)** | `tsc --noEmit` (build gate) | `npx tsc --noEmit -p tsconfig.app.json` | ✅ Safe |
| **Frontend (Vite build)** | Vite bundler | `npx vite build` | ✅ Safe |
| **Frontend (Vitest)** | vitest (when runner available) | `npx vitest run` | ⚠️ Flaky in Cloud |
| **Live E2E Smoke** | Node/tsx scripts | `LIVE_QA=1 ... npx tsx qa/scripts/<script>.ts` | ❌ Manual only |

## Edge Function Tests

All Deno tests live under `supabase/functions/<name>/__tests__/`. They test:
- Payload normalization
- Envelope parsing
- Signal fingerprinting
- Dedupe logic
- Watchlist ingest/diff handling

Run via the Lovable Deno test tool (automated in-IDE).

## Frontend Regression Gate

Since vitest may be unavailable in the Cloud runner, the frontend regression gate is:

```bash
# TypeScript type-check (catches type errors, missing imports, etc.)
npx tsc --noEmit -p tsconfig.app.json

# Vite production build (catches runtime import errors, CSS issues, etc.)
npx vite build
```

Both must succeed for a frontend change to be considered safe.

When vitest IS available:
```bash
npx vitest run
```

## Live E2E Scripts (Opt-in, Manual)

All require `LIVE_QA=1` plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

| Script | Purpose |
|--------|---------|
| `qa_partner_enrich_e2e.ts` | Dispatch → poll → validate org_extractions |
| `qa_recommendations_generate_e2e.ts` | Dispatch → poll → validate ai_recommendations |
| `qa_watchlist_ingest_e2e.ts` | Direct ingest → validate org_snapshots |
| `qa_watchlist_loop_e2e.ts` | Baseline + changed ingest → validate diffs + signals |
| `qa_watchlist_smoke.ts` | Full watchlist loop validation (no Firecrawl) |

### Running a smoke test:
```bash
LIVE_QA=1 \
  SUPABASE_URL=https://lxahadqhpubynuzvraxc.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<key> \
  npx tsx qa/scripts/qa_watchlist_smoke.ts
```

## Gmail Campaigns — Verification

### Verifying Caps
- **Soft cap** (default 500/day): Sends proceed but a `cap_warning` event is logged in `email_campaign_events`. The UI shows a warning banner.
- **Hard cap** (default 2000/day): The `gmail-campaign-send` function rejects with 429. A `cap_blocked` event is logged.
- Query current usage: `SELECT SUM(quantity) FROM usage_events WHERE workflow_key='gmail_campaign' AND event_type='email_sent' AND occurred_at >= CURRENT_DATE;`

### Viewing Billing Usage
- Navigate to **Admin > Workflows > Usage** tab for MTD usage charts.
- The `useEmailBillingUsage` hook provides daily breakdown of `emails_sent` and `emails_failed` from `usage_events`.

### Exporting Recipients CSV
- In the Campaign Builder **Monitor** tab, click the **CSV** button next to status filters.
- Exports all recipients (or filtered by status) with columns: email, name, status, source, error_message, sent_at, provider_message_id.

### Failure Categories (B2)
Gmail send failures are normalized into categories:
- **quota** — 429, rate limit, quota exceeded
- **invalid_address** — invalid email/recipient format
- **bounce** — user not found, mailbox unavailable
- **provider_perm** — 550/553/554 SMTP errors, auth expired
- **provider_temp** — 5xx, timeout, network errors
- **unknown** — unrecognized error patterns

### Resend Eligibility (B3)
Only transient failures are eligible for resend:
- **Eligible**: `provider_temp`, `quota`, `unknown`
- **Excluded**: `invalid_address`, `bounce`, `provider_perm`
- Additional constraint: `sent_at` must be NULL or > 24h ago

### Subject Performance (B1)
Subject stats (`campaign_subject_stats` table) track per-subject sent/failed counts.
- Stats are upserted per `(created_by, subject)` after each campaign send
- Retry sends produce incremental deltas only (no double-counting)
- Visible in Analytics tab of Campaign Builder

### How "Last Outreach" is Computed
- The `useOrgLastOutreach` hook queries `email_campaign_audience` rows with an `opportunity_id`.
- Groups by opportunity, takes the most recent `sent_at` and corresponding campaign.
- Status is `sent` (all succeeded), `failed` (all failed), or `mixed` (both).

## Scheduler Caps

Crawl scheduling is governed by the `get_due_watchlist` RPC:
- **Daily cap**: default 50 crawls/day (configurable via `p_daily_cap` parameter)
- **Batch limit**: default 5 per run (configurable via `p_limit` parameter)
- **Cadence rules**:
  - `manual` → never auto-crawled
  - `daily` → due if `last_crawled_at` > 24h ago (or null)
  - `weekly` → due if `last_crawled_at` > 7d ago (or null)
- **Priority**: oldest `last_crawled_at` first (nulls first)

Usage from n8n or scheduler:
```sql
SELECT * FROM get_due_watchlist(p_limit := 5, p_daily_cap := 50);
```

## Watchlist Signals → Recommendations

The `get_recent_watchlist_signals` RPC provides watchlist signals for recommendations input:
```sql
SELECT * FROM get_recent_watchlist_signals(p_window_hours := 168, p_limit := 200);
```

When calling `n8n-dispatch` for `recommendations_generate`, include `watchlist_signals` array:
```json
{
  "workflow_key": "recommendations_generate",
  "metro_id": "...",
  "watchlist_signals": [{ "org_id": "...", "summary": "...", "confidence": 0.6 }]
}
```

## Contract Schemas

See `qa/contracts/README.md` for JSON Schema definitions and validation tooling.

## Golden Tests

Golden output files in `qa/golden/` capture expected DB writes. Update via:
```bash
npx tsx qa/scripts/update_goldens.ts
```

## Push Notifications — Tiered System (T1/T2/T3)

### Notification Types

| Type | Event Type | Tier | Default ON | Admin Only |
|------|-----------|------|-----------|------------|
| Watchlist Signals | `watchlist_signal` | T1 | ✅ | ❌ |
| Campaign Suggestions | `campaign_suggestion_ready` | T1 | ✅ | ❌ |
| Event Enrichment | `event_enrichment_ready` | T1 | ✅ | ❌ |
| Campaign Send Summary | `campaign_send_summary` | T2 | ❌ | ❌ |
| Automation Failures | `automation_failed` | T1 | ✅ | ✅ |
| Daily Digest | (computed) | T3 | ✅ | ❌ |
| Weekly Summary | (computed) | T3 | ❌ | ❌ |

### Simulating Events

```bash
# Emit a watchlist signal event
curl -X POST $SUPABASE_URL/functions/v1/notification-dispatcher \
  -H "Content-Type: application/json" \
  -H "x-internal-key: $INTERNAL_NOTIFY_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"mode": "emit", "event_type": "watchlist_signal", "user_id": "<UUID>", "fingerprint": "test-sig-1", "title": "📡 Test Signal", "body": "Test body", "tier": "T1", "priority": "normal"}'
```

### Triggering Dispatch

```bash
# Run the dispatcher (processes pending events)
curl -X POST $SUPABASE_URL/functions/v1/notification-dispatcher \
  -H "Content-Type: application/json" \
  -H "x-internal-key: $INTERNAL_NOTIFY_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"mode": "dispatch"}'
```

### Verifying Bundling

1. Emit 3 events with same `bundle_key` and `tier: "T2"` within 45 minutes
2. Run dispatch — should see a single bundled push
3. Check `notification_queue` table: `event_ids` array should contain all 3 event IDs

### Verifying Quiet Hours

1. Set user's `quiet_hours_start=0, quiet_hours_end=23` (always quiet)
2. Emit a normal-priority event
3. Run dispatch — event should be `queued_quiet`, not delivered
4. Check `notification_queue.deliver_after` is set to next morning

### Verifying Caps

1. Emit 11 events for same user
2. Run dispatch
3. First 10 should deliver; 11th should be dropped (hard cap)
4. Check `notification_deliveries` table for status

### Kill Switch

Set env var `NOTIFICATIONS_ENABLED=false` on the `notification-dispatcher` function.
Events are still logged to `notification_events` with `status='dropped'`.

### Fixtures

Test fixtures in `qa/fixtures/notifications/`:
- `watchlist_signal_event.json`
- `campaign_suggestion_event.json`
- `event_enrichment_event.json`
- `automation_failed_event.json`
- `campaign_send_summary_event.json`

### NOT IN SCOPE

The following notification types were explicitly excluded:
- ❌ Search pipeline completion notifications
- ❌ Neighborhood insights completion notifications
