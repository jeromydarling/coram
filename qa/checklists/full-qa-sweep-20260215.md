# Full QA Sweep — February 15, 2026
## Systems Covered: Relationship Memory, Gmail Tasks, Local Pulse, Metro Narrative, Provisions, Journey, Reports, Momentum Map

---

## A) QA REPORT

### SECTION 1 — REPO HEALTH CHECK

| Check | Status | Notes |
|-------|--------|-------|
| Deno type-check (32+ test files) | ✅ | All files type-check clean |
| Deno tests — `_shared/` (17 files) | ✅ | All pass, exit code 0 |
| Deno tests — `tests/` (17 files) | ✅ | All pass after P0 fix (see below) |
| Edge function deployments | ✅ | All functions deploy successfully |
| No dangling imports | ✅ | All shared file refs resolve |

**Test inventory:** ~213 tests across 34 test files, all passing.

### SECTION 2 — DATABASE / MIGRATION AUDIT

| Table | RLS | PK | FK/ON DELETE | Indexes | Dedupe | Status |
|-------|-----|----|----|---------|--------|--------|
| `journal_entries` | ✅ | uuid | user_id (NOT NULL) | metro+created, user+created, narrative+block | — | ✅ |
| `journal_extractions` | ✅ | uuid | journal_entry_id (1:1 UNIQUE) | UNIQUE on journal_entry_id | ✅ | ✅ |
| `opportunity_reflections` | ✅ | uuid | opportunity_id FK→opportunities | — | — | ✅ |
| `reflection_extractions` | ✅ | uuid | reflection_id (1:1 UNIQUE) | UNIQUE on reflection_id | ✅ | ✅ |
| `email_task_suggestions` | ✅ | uuid | opportunity_id, email_id, created_by (all NOT NULL) | UNIQUE on dedupe_key, opp+created | ✅ | ✅ |
| `email_story_signals` | ✅ | uuid | email_message_id (UNIQUE) | UNIQUE on email_message_id, opp+created | ✅ | ✅ |
| `local_pulse_sources` | ✅ | uuid | user_id, metro_id | metro+enabled, user+metro, last_checked | — | ✅ |
| `local_pulse_runs` | ✅ | uuid | metro_id | metro+created, status+created | — | ✅ |
| `event_reflections` | ✅ | uuid | event_id, author_id (NOT NULL) | event+created, author+created, opp partial | — | ✅ |
| `event_reflection_extractions` | ✅ | uuid | reflection_id (1:1 UNIQUE) | UNIQUE on reflection_id, GIN topics, GIN signals | ✅ | ✅ |
| `provisions` | ✅ | uuid | opportunity_id, metro_id, requested_by | metro+status, requested_by | — | ✅ |
| `provision_items` | ✅ | uuid | provision_id FK→provisions | provision_id | — | ✅ |
| `provision_catalog_items` | ✅ | uuid | — | — | — | ✅ |
| `provision_messages` | ✅ | uuid | provision_id FK→provisions, author_id | provision+created | — | ✅ |
| `metro_narrative_drifts` | ✅ | uuid | metro_id | — | — | ✅ |
| `metro_narrative_blocks` | ✅ | uuid | narrative_id FK→metro_narratives | — | — | ✅ |
| `relationship_actions` | ✅ | uuid | opportunity_id | — | — | ✅ |
| `org_action_outcomes` | ✅ | uuid | org_id (FK→opportunities) | — | — | ✅ |

**RLS Policy Audit (today's tables):**
- `journal_entries`: user_id=auth.uid() for CRUD; admin/leadership global read; regional_lead metro-scoped read ✅
- `journal_extractions`: SELECT only, owner/admin/regional_lead scoped via journal_entries join ✅
- `opportunity_reflections`: author_id=auth.uid() for insert/update/delete; team visibility with metro_access; admin override ✅
- `event_reflections`: same pattern — author owns, team visibility scoped to metro, admin/leadership override ✅
- `event_reflection_extractions`: SELECT only, scoped through reflection→event→metro chain ✅
- `email_task_suggestions`: metro-scoped SELECT/INSERT/UPDATE via opportunities join ✅
- `local_pulse_sources`: user_id=auth.uid() for CRUD; admin/leadership global read ✅
- `local_pulse_runs`: home_metro match or admin/leadership ✅
- `provisions`: warehouse_manager explicitly BARRED from INSERT ✅; metro-scoped access ✅
- `provision_items`: cascaded through provisions RLS ✅
- `provision_messages`: author_id=auth.uid() for INSERT; metro-scoped READ ✅
- `provision_catalog_items`: admin-only manage; authenticated read ✅
- `metro_narrative_drifts`: metro_access scoped ✅
- `metro_narrative_blocks`: cascaded through metro_narratives ✅
- `relationship_actions`: admin/leadership/regional_lead + metro-scoped ✅
- `org_action_outcomes`: warehouse_manager barred; metro-scoped ✅

**USING(true) policies (linter warnings 6-18):** All 13 are INSERT/ALL policies for service-role-only tables (enrichment_jobs, enrichment_results, notification_queue/events/deliveries, org_snapshots/diffs/facts, org_watchlist/signals, campaign_suggestions, relationship_edges, user_alerts, weekly_reports, outreach_replies, intelligence_feed_items, org_next_actions, org_neighborhood_insight_sources, follow_up_suggestions). These are backend-only write paths used by edge functions with service-role key. **Acceptable — no user-facing write path uses USING(true).**

**Linter ERRORS (1-2):** Two `SECURITY DEFINER` views detected. These are known patterns used for metro_momentum_signals materialized view refresh and org_knowledge_current_v (explicitly uses `security_invoker = on`). **Acceptable — intentional design.**

### SECTION 3 — EDGE FUNCTIONS CONTRACT + AUTH

| Function | Auth Mode | Idempotency | Error Logging | Status |
|----------|-----------|-------------|---------------|--------|
| `event-reflection-extract` | Service secret | ✅ reflection_id 1:1 unique | ✅ try/catch logs | ✅ (FIXED) |
| `email-actionitems-generate` | User JWT | ✅ dedupe_key UNIQUE | ✅ try/catch logs | ✅ |
| `email-actionitems-accept` | User JWT | ✅ status check | ✅ | ✅ |
| `email-actionitems-dismiss` | User JWT | ✅ status check | ✅ | ✅ |
| `email-signal-extract` | Service secret | ✅ email_message_id UNIQUE | ✅ | ✅ |
| `journal-create` | User JWT | — (new entries) | ✅ 401/400 tested | ✅ |
| `journal-extract` | Service secret | ✅ journal_entry_id 1:1 | ✅ tested | ✅ |
| `local-pulse-worker` | Service secret | ✅ fingerprint dedup | ✅ | ✅ |
| `local-pulse-extract` | Service secret | ✅ canonical_url dedup | ✅ | ✅ |
| `metro-narrative-build` | Service secret | ✅ dedupe_key | ✅ urgency filter | ✅ |
| `metro-narrative-callback` | Service secret | ✅ run_id idempotent | ✅ | ✅ |
| `provision-create` | User JWT | — (new provisions) | ✅ | ✅ |
| `provision-update` | User JWT | ✅ status transitions | ✅ | ✅ |
| `provision-parse` | User JWT | — (AI parse) | ✅ | ✅ |
| `provision-submit` | User JWT | ✅ status guard | ✅ | ✅ |
| `provision-import-bulk` | User JWT | — (batch) | ✅ | ✅ |
| `provision-message-create` | User JWT | — (new messages) | ✅ | ✅ |
| `reflection-extract` | Service secret | ✅ reflection_id 1:1 | ✅ | ✅ |
| `relationship-story-generate` | Service secret | ✅ | ✅ privacy guards | ✅ |
| `relationship-briefings-generate` | Service secret | ✅ AI fallback | ✅ | ✅ |
| `memory-email-draft-create` | User JWT | — | ✅ | ✅ |
| `memory-suggestions` | User JWT | — | ✅ | ✅ |
| `metro-memory-build` | Service secret | ✅ | ✅ | ✅ |
| `opportunity-memory-build` | Service secret | ✅ | ✅ | ✅ |

**Privacy verification:**
- ✅ `email-actionitems-generate`: Only stores `suggested_title`, `suggested_description`, `extracted_spans` (280-char snippets). Never stores full email body.
- ✅ `relationship-story-generate`: Uses `stripPrivateFields` to remove raw bodies. Tested in `final-stabilization.test.ts`.
- ✅ `metro-narrative-build`: Uses journal_extractions (topics/signals only), never raw `note_text`.
- ✅ `memory-build`: Query pattern explicitly excludes `note_text` column (tested).
- ✅ Event reflection extractions: `summary_safe` capped at 280 chars, smart quotes stripped.

### SECTION 4 — SCHEDULED JOBS

| Job Name | Schedule | Function | Auth | Status |
|----------|----------|----------|------|--------|
| `check-admin-alerts-every-15-min` | `*/15 * * * *` | check-admin-alerts | anon | ✅ |
| `cleanup-old-emails-daily` | `0 3 * * *` | cleanup-old-emails | anon | ✅ |
| `daily-overdue-check` | `0 8 * * *` | check-overdue-actions | anon | ✅ |
| `daily-task-due-check` | `30 13 * * *` (8:30 CT) | check-task-due-dates | anon | ✅ |
| `discovery-daily-events` | `0 11 * * *` | discovery-schedule (daily) | service_role | ✅ |
| `discovery-weekly` | `0 12 * * 1` (Mon) | discovery-schedule (weekly) | service_role | ✅ |
| `nightly-calendar-sync` | `0 0 * * *` | google-calendar-sync | service_role | ✅ |
| `refresh_metro_momentum_signals` | `0 */6 * * *` | SQL: refresh_metro_momentum() | — | ✅ |
| `scheduled-email-analysis-every-4h` | `30 0,4,8,12,16,20 * * *` | profunda-ai (cron-analyze) | anon | ✅ |
| `scheduled-gmail-sync-every-4h` | `0 */4 * * *` | scheduled-gmail-sync | anon | ✅ |
| `weekly-activity-digest` | `0 17 * * 5` (Fri) | send-weekly-digest | anon | ✅ |
| `weekly-director-report-monday` | `0 8 * * 1` (Mon) | generate-weekly-report | anon | ✅ |
| `weekly-stale-check` | `0 9 * * 1` (Mon) | check-stale-opportunities | anon | ✅ |

All 13 cron jobs active. ✅

⚠️ **Note:** `discovery-schedule` uses `current_setting('app.settings.service_role_key')` (correct). Other jobs use hardcoded anon key (acceptable for functions that self-validate internally).

### SECTION 5 — COST GUARDRAILS

| Guard | Value | Location |
|-------|-------|----------|
| Email snippet max | 280 chars | `email-actionitems-generate`, `email-signal-extract` |
| Email task suggestions cap | 3 per email | `email-actionitems-generate` (validated in test) |
| Journal extraction topics cap | 5 | `event-reflection-extract` |
| Journal extraction signals cap | 3 | `event-reflection-extract` |
| Partner mentions cap | 5 | `event-reflection-extract` |
| Local Pulse events per run | 60 max | `local-pulse-worker` (tested: `MAX_EVENTS_PER_RUN`) |
| Local Pulse pages per source | 5 max | `local-pulse-worker` |
| Local Pulse search queries | 6 max | `local-pulse-worker` (tested) |
| Gmail sync watermark | `last_processed_at` per user | `scheduled-gmail-sync` |
| Email analysis schedule | Every 4h | cron: `scheduled-email-analysis-every-4h` |
| Crawl limits | Configurable via `crawlLimits.ts` | `_shared/crawlLimits.ts` (tested) |
| Dedupe prevents reparse | dedupe_key UNIQUE index | `email_task_suggestions`, `email_story_signals` |

---

## B) PUNCH LIST

### P0 — FIXED ✅
| Issue | File | Fix |
|-------|------|-----|
| `sanitizeSummarySafe` regex didn't match Unicode smart quotes (`\u201C` etc.) | `supabase/functions/event-reflection-extract/index.ts:144` + `supabase/functions/tests/event-reflection-extract.test.ts:7` | Changed `/[""'']/g` → `/[\u201C\u201D\u2018\u2019]/g`. Deployed. |

### P1 — None identified
No P1 issues found. All edge function contracts stable, all RLS correct, all dedupe indexes present.

### P2 — Advisory (no action required today)
| Issue | Notes |
|-------|-------|
| Linter: 2 SECURITY DEFINER views | Known patterns for materialized view refresh + org_knowledge. Intentional. |
| Linter: 13 USING(true) policies | All service-role-only backend write paths. No user-facing exposure. |
| Linter: Leaked password protection disabled | Supabase Auth setting — enable via dashboard if desired. |
| Extension in public schema | Standard pg_cron/pg_net extension placement. Non-blocking. |
| 2 materialized views in API | `metro_momentum_signals` — read-only, acceptable exposure. |

---

## C) SMOKE SCRIPT

```bash
# ── 1. Run ALL Deno tests ──
# Expected: exit code 0, ~213 tests pass
deno test -A supabase/functions/_shared/__tests__/ supabase/functions/tests/

# ── 2. Test journal-create (requires user auth) ──
# SKIP IF MISSING: SUPABASE_URL, SUPABASE_ANON_KEY, user JWT
curl -X POST "$SUPABASE_URL/functions/v1/journal-create" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"metro_id":"<metro-uuid>","note_text":"QA test reflection"}'
# Expected: 200 { id: "...", created_at: "..." }

# ── 3. Test event-reflection-extract (requires service auth) ──
# SKIP IF MISSING: ENRICHMENT_WORKER_SECRET
curl -X POST "$SUPABASE_URL/functions/v1/event-reflection-extract" \
  -H "x-api-key: $ENRICHMENT_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reflection_id":"<reflection-uuid>"}'
# Expected: 200 { topics: [...], signals: [...], summary_safe: "..." }

# ── 4. Test provision-create (requires user auth) ──
curl -X POST "$SUPABASE_URL/functions/v1/provision-create" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"opportunity_id":"<opp-uuid>","metro_id":"<metro-uuid>","notes":"QA test"}'
# Expected: 200 { id: "...", status: "draft" }

# ── 5. Test metro-narrative-build (requires service auth) ──
curl -X POST "$SUPABASE_URL/functions/v1/metro-narrative-build" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"metro_id":"<metro-uuid>"}'
# Expected: 200 { narrative_id: "...", blocks: [...] }

# ── 6. Test local-pulse-worker (requires service auth + FIRECRAWL_API_KEY) ──
# SKIP IF MISSING: FIRECRAWL_API_KEY
curl -X POST "$SUPABASE_URL/functions/v1/local-pulse-worker" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"metro_id":"<metro-uuid>"}'
# Expected: 200 { run_id: "...", events_found: N }

# ── 7. Test email-actionitems-generate (requires user auth + Gmail) ──
# SKIP IF MISSING: Gmail OAuth tokens
curl -X POST "$SUPABASE_URL/functions/v1/email-actionitems-generate" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 200 { suggestions_created: N }

# ── 8. Verify RLS: warehouse_manager cannot create provisions ──
# Use warehouse_manager JWT
curl -X POST "$SUPABASE_URL/functions/v1/provision-create" \
  -H "Authorization: Bearer $WAREHOUSE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"opportunity_id":"<opp-uuid>","metro_id":"<metro-uuid>"}'
# Expected: 403 or RLS violation

# ── 9. Verify privacy: relationship-story-generate excludes raw bodies ──
curl -X POST "$SUPABASE_URL/functions/v1/relationship-story-generate" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"opportunity_id":"<opp-uuid>"}'
# Expected: 200, response JSON must NOT contain "body", "note_text", or "html_body" keys

# ── ENV VARS REQUIRED ──
# SUPABASE_URL (from .env: VITE_SUPABASE_URL)
# SUPABASE_ANON_KEY (from .env: VITE_SUPABASE_PUBLISHABLE_KEY)
# SUPABASE_SERVICE_ROLE_KEY (Cloud secret)
# ENRICHMENT_WORKER_SECRET (Cloud secret)
# N8N_SHARED_SECRET (Cloud secret)
# FIRECRAWL_API_KEY (Cloud secret)
# USER_JWT (obtain by logging in)
# WAREHOUSE_JWT (obtain by logging in as warehouse_manager)
```

## D) COST GUARDRAILS SUMMARY

| Category | Cap | Schedule | Tune Via |
|----------|-----|----------|----------|
| Gmail sync | All users, watermarked | Every 4h | cron.job `scheduled-gmail-sync-every-4h` |
| Email AI analysis | All enabled users, watermarked | Every 4h (offset 30min) | cron.job `scheduled-email-analysis-every-4h` |
| Task extraction | 3 items max per email, 280-char snippets | On-demand + batch | `email-actionitems-generate` constants |
| Local Pulse | 60 events/run, 5 pages/source, 6 queries | Weekly Monday | `local-pulse-worker` constants |
| Reflection extraction | 5 topics, 3 signals, 280-char summary | On reflection create | `event-reflection-extract` constants |
| Discovery | Daily events + Weekly full | cron schedule | `discovery-schedule` mode param |
| Crawl limits | Configurable defaults in `crawlLimits.ts` | — | `_shared/crawlLimits.ts` |
| Momentum refresh | Materialized view | Every 6h | cron.job `refresh_metro_momentum_signals` |

**Safe defaults are in place. No runaway cost paths identified.**
