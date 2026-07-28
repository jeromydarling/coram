# n8n-ingest Contract Schemas

This folder contains JSON Schema contracts (draft 2019-09) defining the expected request body for each workflow handled by the `n8n-ingest` edge function.

## Files

| File | Workflow |
|------|----------|
| `partner_enrich.payload.schema.json` | `partner_enrich` |
| `opportunity_monitor.payload.schema.json` | `opportunity_monitor` |
| `recommendations_generate.payload.schema.json` | `recommendations_generate` |

## Purpose

- **Source of truth** for the data contract between n8n workflows and the ingest endpoint.
- All fixtures in `qa/fixtures/n8n/` with `.valid` in their name must validate against the matching schema.
- Any workflow or schema change **must** update the schema and fixtures together.

## Validation

The helper `validateFixtureAgainstSchema.ts` provides a `validateFixture()` function (uses Zod) that programmatically enforces the same rules as the JSON Schema files.

## Live Tests (opt-in)

Two live smoke test scripts exist at `qa/scripts/`:

| Script | Purpose | Env Vars Required |
|--------|---------|-------------------|
| `live_n8n_ingest_smoke.ts` | POST to n8n-ingest with partner_enrich fixture | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `live_n8n_dispatch_smoke.ts` | POST to n8n-dispatch with a real JWT | `SUPABASE_URL`, `TEST_USER_JWT` |
| `smoke_partner_enrich.ts` | Quick dispatch of partner_enrich (no polling) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `smoke_recommendations_generate.ts` | Quick dispatch of recommendations_generate (no polling) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `qa_partner_enrich_e2e.ts` | Full E2E: dispatch → poll → validate extractions | `LIVE_QA=1`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `qa_recommendations_generate_e2e.ts` | Full E2E: dispatch → poll → validate ai_recommendations | `LIVE_QA=1`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

Run with `npx tsx qa/scripts/<script>.ts`. These are **never** run in CI.

## Scheduled Workflow Auth (Server-to-Server)

n8n scheduled workflows can call `n8n-dispatch` without a user JWT by using a shared secret header.

### Setup

1. **Set the secret** in Lovable Cloud secrets:
   - Secret name: `N8N_SCHEDULE_SECRET`
   - Value: a strong random string (e.g., `openssl rand -hex 32`)

2. **Configure n8n**: In your n8n workflow's Workflow Constants node, add:
   - `SCHEDULE_SECRET`: same value as `N8N_SCHEDULE_SECRET`

3. **Call n8n-dispatch** from n8n HTTP Request node:
   ```
   POST ${SUPABASE_URL}/functions/v1/n8n-dispatch
   Headers:
     Content-Type: application/json
     x-n8n-schedule-secret: {{ $node["Workflow Constants"].json.SCHEDULE_SECRET }}
   Body:
     { "workflow_key": "partner_enrich", "org_name": "Example Org", ... }
   ```

### Behavior

- **No `Authorization` header needed** — the schedule secret replaces JWT auth
- **RBAC is bypassed** — schedule secret grants access to all allowlisted workflows
- **`triggered_by` is null** — system-initiated runs have no user association
- **Rate limits are skipped** — schedule auth is trusted server-to-server
- **Workflow key must be in the allowlist** — invalid keys are rejected with 400
- If both `x-n8n-schedule-secret` and `Authorization` are present, schedule secret takes priority

## Hands-off E2E Partner Enrich

A fully automated E2E test that dispatches a fresh `partner_enrich` run, polls `automation_runs` until completion, and validates `org_extractions` writes. **Opt-in only** — requires `LIVE_QA=1`.

```bash
LIVE_QA=1 \
  SUPABASE_URL=https://lxahadqhpubynuzvraxc.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<your_key> \
  npx tsx qa/scripts/qa_partner_enrich_e2e.ts
```

**Expected output:**
1. Dispatches with a fresh `run_id`
2. Polls `automation_runs` until `status=processed` (timeout: 180s)
3. Asserts ≥1 row in `org_extractions` for that `run_id`
4. Prints JSON summary: `{ ok, run_id, automation_status, extraction_rows }`

Without `LIVE_QA=1` the script exits cleanly with a usage hint — safe in CI.

## Recommendations Generate — E2E QA

```bash
LIVE_QA=1 \
  SUPABASE_URL=https://lxahadqhpubynuzvraxc.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<your_key> \
  npx tsx qa/scripts/qa_recommendations_generate_e2e.ts
```

**Notes:**
- Requires `SUPABASE_SERVICE_ROLE_KEY`
- Creates a fresh `automation_runs` row for `recommendations_generate`
- Polls until `processed` or `error` (timeout: 180s)
- Fails if no ingest callback is received (no `ai_recommendations` rows and no persisted payload)
- Opt-in only — requires `LIVE_QA=1` to prevent accidental service-role usage

**Expected output:**
1. Dispatches with a fresh `run_id`
2. Polls `automation_runs` until `status=processed`
3. Asserts ≥1 row in `ai_recommendations` for that `run_id`
4. Prints JSON summary: `{ ok, run_id, automation_status, recommendation_rows }`

Without `LIVE_QA=1` the script exits cleanly with a usage hint — safe in CI.

## Golden Tests

Golden output files in `qa/golden/` capture expected DB write intents for each workflow. If the ingest logic changes, update goldens via:

```bash
npx tsx qa/scripts/update_goldens.ts
```

Do not run during normal tests — golden tests compare against these snapshots automatically.

## Automation Contract

These invariants MUST hold for all n8n automation workflows:

### Workflow Configuration
1. Webhook paths have **NO leading slash** (e.g. `webhook/partner-enrich`, not `/webhook/partner-enrich`)
2. Webhook Trigger node responds **"On Received"** (not "Last Node")
3. Workflow constants referenced via `{{ $node["Workflow Constants"].json.* }}` — no literal placeholders
4. External HTTP nodes must have **hard timeouts ≤ 60s**
5. **Continue On Fail** + **Always Output Data** enabled where available
6. Every workflow MUST end with an `n8n-ingest` callback (success or error)

### Data Contract
7. `n8n-ingest` accepts `payload` OR `result`, but workflows **should emit `payload`**
8. Empty-input short-circuit for `recommendations_generate` is **required** (return reason + inputs_summary)
9. Signal fingerprinting uses SHA-256 of `signal_type|signal_value|source_url`

### Workflow Key Allowlist
Only these keys are valid across dispatch, ingest, and QA:
- `partner_enrich`
- `opportunity_monitor`
- `recommendations_generate`

The single source of truth is `src/lib/automationWorkflowKeys.ts`.

### Status Lifecycle
```
queued → dispatched → running → processed | error
```
- Runs in `dispatched` or `running` for >10 minutes are **stuck**
- The health RPC surfaces stuck runs automatically
- Stuck runs can be retried via the admin dashboard or `automation-retry` edge function

### Rate Controls
- **10 dispatches / 10 minutes** per user per workflow_key
- **3 concurrent runs** max per user per workflow_key (dispatched + running)
- On limit hit: HTTP 429 with `RATE_LIMITED` or `CONCURRENCY_LIMIT` code

## Automation Health Dashboard

**Location:** `/admin/automation-health`

**Access:** Admin, Leadership, Regional Lead roles only.

### Metrics

| Metric | Description |
|--------|-------------|
| Total Runs | Count of `automation_runs` rows in the selected window |
| Error Rate | `error / total * 100` per workflow |
| Avg Duration | Mean `processed_at - created_at` for completed runs |
| Stuck Runs | Runs in `dispatched` or `running` status for >10 minutes |

### Invariants

- Every workflow execution MUST produce an `automation_runs` row via `n8n-dispatch`.
- Status transitions: `queued → dispatched → running → processed | error`.
- Runs stuck >10min in `dispatched`/`running` typically indicate n8n node failures or missing credentials.
- The dashboard calls a single RPC (`get_automation_health`) — no direct table scans.

### Fixture

A sample RPC response shape is at `qa/fixtures/automation_health_response.fixture.json`.
