# HubSpot Integration — Sync Surface Map & Spec

## Architecture

- **No n8n.** All logic runs in Supabase Edge Functions + cron.
- OAuth tokens stored in `hubspot_connections` (encrypted at rest via Supabase).
- Idempotency via `hubspot_object_map` with `last_hash` fingerprinting.
- All sync operations are service-role authenticated edge functions.

---

## Mode Selection (at setup)

| Mode | Primary HubSpot Object | When to Use |
|------|----------------------|-------------|
| **Company-first** (default) | Company | Nonprofits tracking org relationships |
| **Deal-first** | Deal (in a pipeline) | Teams using HubSpot pipeline workflows |

---

## Object Mapping

### Company-First Mode

| Profunda Entity | HubSpot Object | Direction |
|-----------------|---------------|-----------|
| `opportunities` | Company | Push + Pull |
| `contacts` | Contact (associated to Company) | Push + Pull |
| `provisions` | Custom object or Note | Push only |
| `contact_tasks` | Task (associated to Contact) | Push only |
| `opportunity_reflections` | Note (on Company) | Push only (opt-in, safe summary only) |

### Deal-First Mode

| Profunda Entity | HubSpot Object | Direction |
|-----------------|---------------|-----------|
| `opportunities` | Deal (+ Company for association) | Push + Pull |
| `contacts` | Contact (associated to Deal + Company) | Push + Pull |
| `provisions` | Line item or Note on Deal | Push only |
| `contact_tasks` | Task (associated to Contact) | Push only |
| `opportunity_reflections` | Note (on Deal) | Push only (opt-in) |

---

## Field Mapping: Opportunities → Company/Deal

| Profunda Field | HubSpot Property | Direction | Notes |
|---------------|-----------------|-----------|-------|
| `organization` | `name` | push | Company name |
| `website_url` | `domain` / `website` | push+pull | Primary match key |
| `website_domain` | `domain` | push | Extracted domain |
| `address_line1` | `address` | push | |
| `city` | `city` | push | |
| `state` | `state` | push | |
| `zip` | `zip` | push | |
| `stage` | `profunda_journey_stage` (custom) | push | Custom property created on first push |
| `status` | `profunda_status` (custom) | push | |
| `partner_tier` | `profunda_partner_tier` (custom) | push | |
| `last_contact_date` | `profunda_last_touch` (custom) | push | |
| `metro_id` → metro name | `profunda_metro` (custom) | push | Resolved via JOIN |
| `notes` | Note (engagement) | push | Safe snippet, never raw |
| `best_partnership_angle` | `profunda_partnership_angle` (custom) | push | Array → comma-separated |

### Deal-First Additional Fields

| Profunda Field | HubSpot Property | Notes |
|---------------|-----------------|-------|
| `stage` | Deal stage (mapped via `stage_mapping`) | User maps at setup |
| `status` | `dealstage` lifecycle | |

---

## Field Mapping: Contacts

| Profunda Field | HubSpot Property | Direction |
|---------------|-----------------|-----------|
| `name` | `firstname` + `lastname` (split) | push+pull |
| `email` | `email` | push+pull (primary match key) |
| `phone` | `phone` | push+pull |
| `title` | `jobtitle` | push+pull |

---

## Field Mapping: Provisions (Push Only)

| Profunda Field | HubSpot Property | Notes |
|---------------|-----------------|-------|
| `status` | Note body | Provision summary as note |
| `total_cents` | Note body | Formatted as currency |
| `invoice_type` | Note body | |
| `requested_at` | Note timestamp | |

---

## Field Mapping: Tasks (Push Only)

| Profunda Field | HubSpot Property |
|---------------|-----------------|
| `title` | `hs_task_subject` |
| `description` | `hs_task_body` |
| `due_date` | `hs_timestamp` |
| `is_completed` | `hs_task_status` (COMPLETED/NOT_STARTED) |

---

## Field Mapping: Reflections (Push Only, Opt-In)

| Profunda Field | HubSpot Property | Safety |
|---------------|-----------------|--------|
| `body` | Note (engagement) | **NEVER push raw body.** Push first 200 chars + "[Reflection in Profunda]" |
| `visibility` | — | Only push if visibility = 'team' (never 'private') |

---

## Rate Limits & Batching

- HubSpot API: 100 requests / 10 seconds (OAuth apps)
- Batch API: up to 100 objects per batch call
- **Strategy:**
  - Push batch: max 50 entities per edge function invocation
  - Inter-request delay: 150ms
  - If 429 received: exponential backoff (1s, 2s, 4s, max 3 retries)
  - Daily scheduled sync processes max 200 changed entities per connection

---

## Failure Handling & Retry

| Scenario | Action |
|----------|--------|
| 401 Unauthorized | Attempt token refresh; if fails, mark connection `status='error'` |
| 429 Rate Limited | Backoff + retry (max 3); log to `hubspot_sync_log` |
| 500 Server Error | Retry once after 2s; log failure |
| Network timeout (>15s) | Abort + log; retry on next scheduled run |
| Invalid field mapping | Skip entity, log as `skipped` with message |
| Duplicate detection | Use `hubspot_object_map.last_hash` to skip unchanged payloads |

---

## Idempotency Contract

1. Before push: check `hubspot_object_map` for existing HubSpot ID
2. If found: compute payload hash → compare to `last_hash` → skip if unchanged
3. If not found: create in HubSpot → store mapping
4. After push: update `last_synced_at` and `last_hash`
5. **Never** create duplicate HubSpot objects for the same Profunda entity

---

## Pull Safety Contract

1. Pull-preview: read-only fetch from HubSpot, returns diff summary, **zero DB writes**
2. Pull-apply: requires explicit user confirmation
3. Default: "do not overwrite non-empty Profunda fields"
4. Admin-only "overwrite mode" with warning
5. Ambiguous matches (no domain match, multiple name matches) → "review needed" list

---

## Privacy Rules

- `opportunity_reflections` with `visibility='private'` are **never** pushed
- Team-visible reflections: push safe summary only (first 200 chars)
- No raw email bodies are ever sent to HubSpot
- Impulsus entries are never sent to HubSpot
- OAuth tokens are stored encrypted, never exposed to client
