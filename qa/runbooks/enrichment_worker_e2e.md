# Enrichment Worker Loop — End-to-End Runbook

> **Time to complete**: ~10 minutes  
> **Prerequisites**: Supabase Cloud project with deployed edge functions  

---

## Deterministic Fixture UUIDs

Use these throughout the runbook for repeatability:

| Name | UUID |
|------|------|
| `FIXTURE_ENTITY_ID` | `cccccccc-1111-2222-3333-444444444444` |
| `FIXTURE_RUN_ID` | `dddddddd-1111-2222-3333-444444444444` |

---

## CHECK 0: Preconditions

### Supabase Secrets

Confirm these are set (all exist in the project):

- `ENRICHMENT_WORKER_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### n8n HTTP Header Credential

If using n8n, ensure the HTTP Header credential is:

```
Authorization: Bearer <ENRICHMENT_WORKER_SECRET value>
```

### Edge Functions Deployed

All three must be deployed:

- `enrichment-job-enqueue` — creates jobs
- `enrichment-job-next` — leases jobs (called by n8n worker)
- `enrichment-callback` — receives results (called by n8n worker)

---

## CHECK 1: Seed a Job

### Option A — Via SQL (immediate)

Run in Lovable Cloud → Run SQL:

```sql
INSERT INTO enrichment_jobs (run_id, entity_type, entity_id, source_url)
VALUES (
  'dddddddd-1111-2222-3333-444444444444',
  'grant',
  'cccccccc-1111-2222-3333-444444444444',
  'https://example.com/test-grant'
);
```

### Option B — Via Edge Function (recommended)

```bash
curl -X POST \
  https://lxahadqhpubynuzvraxc.supabase.co/functions/v1/enrichment-job-enqueue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ENRICHMENT_WORKER_SECRET>" \
  -d '{
    "run_id": "dddddddd-1111-2222-3333-444444444444",
    "entity_type": "grant",
    "entity_id": "cccccccc-1111-2222-3333-444444444444",
    "source_url": "https://example.com/test-grant"
  }'
```

**Expected response** (201):
```json
{
  "ok": true,
  "duplicate": false,
  "job": {
    "id": "<auto-uuid>",
    "run_id": "dddddddd-1111-2222-3333-444444444444",
    "entity_type": "grant",
    "entity_id": "cccccccc-1111-2222-3333-444444444444",
    "source_url": "https://example.com/test-grant",
    "status": "queued",
    "attempts": 0
  }
}
```

**Replay test** — run the same curl again. Expected (200):
```json
{ "ok": true, "duplicate": true, "job": { ... } }
```

---

## CHECK 2: Confirm Job is Queued

```sql
SELECT id, run_id, entity_type, entity_id, source_url, status, attempts,
       lease_expires_at, leased_by, created_at
FROM enrichment_jobs
WHERE entity_id = 'cccccccc-1111-2222-3333-444444444444'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
| Column | Value |
|--------|-------|
| `status` | `queued` |
| `attempts` | `0` |
| `lease_expires_at` | `NULL` |
| `leased_by` | `NULL` |

---

## CHECK 3: Lease the Job

### Via n8n workflow (production path)

Run the n8n enrichment worker workflow manually, or wait for cron tick.

### Via curl (direct test)

```bash
curl -X GET \
  "https://lxahadqhpubynuzvraxc.supabase.co/functions/v1/enrichment-job-next?lease_seconds=300&worker_id=manual-test&max_attempts=3" \
  -H "Authorization: Bearer <ENRICHMENT_WORKER_SECRET>"
```

**Expected response** (200):
```json
{
  "ok": true,
  "job": {
    "run_id": "dddddddd-1111-2222-3333-444444444444",
    "entity_type": "grant",
    "entity_id": "cccccccc-1111-2222-3333-444444444444",
    "source_url": "https://example.com/test-grant",
    "attempts": 1
  }
}
```

---

## CHECK 4: Confirm Job is Leased

```sql
SELECT status, attempts, lease_expires_at, leased_by
FROM enrichment_jobs
WHERE run_id = 'dddddddd-1111-2222-3333-444444444444';
```

**Expected**:
| Column | Value |
|--------|-------|
| `status` | `leased` |
| `attempts` | `1` |
| `lease_expires_at` | `~5 min from now` |
| `leased_by` | `manual-test` |

---

## CHECK 5: Submit Callback

Simulate the n8n worker completing the job:

```bash
curl -X POST \
  https://lxahadqhpubynuzvraxc.supabase.co/functions/v1/enrichment-callback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ENRICHMENT_WORKER_SECRET>" \
  -d '{
    "run_id": "dddddddd-1111-2222-3333-444444444444",
    "workflow": "enrichment_grant_v1",
    "status": "success",
    "entity_type": "grant",
    "entity_id": "cccccccc-1111-2222-3333-444444444444",
    "source_url": "https://example.com/test-grant",
    "scrape": { "ok": true, "bytes": 12345 },
    "enrichment": {
      "grant_title": "Test Grant",
      "amount": 50000,
      "deadline": "2026-06-01"
    },
    "error": null,
    "occurred_at": "2026-02-09T23:00:00Z"
  }'
```

**Expected response** (200):
```json
{ "ok": true, "duplicate": false, "result_id": "<uuid>" }
```

### Confirm enrichment_results row:

```sql
SELECT id, run_id, workflow, status, entity_type, entity_id,
       scrape_ok, scrape_bytes, enrichment, error, occurred_at, received_at
FROM enrichment_results
WHERE entity_id = 'cccccccc-1111-2222-3333-444444444444'
ORDER BY received_at DESC
LIMIT 1;
```

**Expected**:
| Column | Value |
|--------|-------|
| `run_id` | `dddddddd-1111-2222-3333-444444444444` |
| `status` | `success` |
| `scrape_ok` | `true` |
| `scrape_bytes` | `12345` |
| `enrichment` | `{"grant_title":"Test Grant",...}` |
| `error` | `NULL` |
| `received_at` | populated |

---

## CHECK 6: Confirm Job Terminal State

```sql
SELECT status, last_error
FROM enrichment_jobs
WHERE run_id = 'dddddddd-1111-2222-3333-444444444444';
```

**Expected**:
| Column | Value |
|--------|-------|
| `status` | `completed` |
| `last_error` | `NULL` |

### Replay test — submit same callback again:

```json
{ "ok": true, "duplicate": true, "result_id": "<same uuid>" }
```

---

## Cleanup

```sql
DELETE FROM enrichment_results WHERE entity_id = 'cccccccc-1111-2222-3333-444444444444';
DELETE FROM enrichment_jobs WHERE entity_id = 'cccccccc-1111-2222-3333-444444444444';
```

---

## Failure Mode Table

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` on any endpoint | `ENRICHMENT_WORKER_SECRET` mismatch between caller and Supabase secret | Verify secret value matches in n8n HTTP Header credential and Supabase secrets |
| `503 Server misconfigured` | Secret not set in Supabase environment | Add `ENRICHMENT_WORKER_SECRET` via Lovable Cloud secrets |
| `405 Method not allowed` | Wrong HTTP method (e.g., GET to enqueue) | Use POST for enqueue/callback, GET for job-next |
| Enqueue returns `400` with errors | Invalid body fields (bad UUID, unsupported entity_type, bad URL) | Fix request payload per validation rules |
| Job-next returns `{"job": null}` | No queued jobs, or all attempts exhausted, or all currently leased | Seed a new job; check `max_attempts` param |
| Callback returns `503 Database write failed` | DB connection issue or schema mismatch | Check Supabase logs; verify `enrichment_results` table schema |
| Job stuck in `leased` status | Worker crashed before callback; lease hasn't expired | Wait for `lease_expires_at` to pass, then re-lease; or use `mark_stuck_runs_failed()` |
| Job stays `queued` after lease call | RPC `enrichment_job_next` failed or returned null | Check `max_attempts` vs current `attempts`; verify RPC exists |
| Callback succeeds but job status unchanged | `enrichment_jobs.update` failed silently (non-matching `run_id`) | Verify `run_id` in callback matches job's `run_id` |
| Duplicate callback returns same `result_id` | Expected behavior — idempotency working correctly | No action needed |

---

## File Reference

| File | Purpose |
|------|---------|
| `supabase/functions/enrichment-job-enqueue/index.ts` | Service-role endpoint to create jobs |
| `supabase/functions/enrichment-job-enqueue/__tests__/enrichment-job-enqueue.test.ts` | 21 unit tests (auth, validation, responses) |
| `supabase/functions/enrichment-job-next/index.ts` | Service-role endpoint to lease next job |
| `supabase/functions/enrichment-job-next/__tests__/enrichment-job-next.test.ts` | 11 unit tests |
| `supabase/functions/enrichment-callback/index.ts` | Service-role endpoint to receive results |
| `supabase/functions/enrichment-callback/__tests__/enrichment-callback.test.ts` | 29 unit tests |
