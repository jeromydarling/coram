
# CROS Federation Email Tracker — Propria pilot (Gardener-only)

Ship a Gardener-only campaign tracker inside the Operator Console, wired first to the **Propria** federation app (`slug='propria'`, `propria.land`, `propria.lovable.app`). Includes CSV import for recipients per campaign. Tracks four signals: opens, clicks, replies, and signup / customer conversion at Propria. Tenants never see any of it.

## Zone alignment
- **MACHINA** — send extension, tracking endpoints, reply sweep, federation signup ingest, CSV import
- **SCIENTIA** — narrative analytics view

## 1. Schema (single migration)

```
gardener_tracked_campaigns
  id, campaign_id (FK email_campaigns) UNIQUE,
  federation_app_id (FK federation_apps),  -- Propria for pilot
  gardener_user_id, tracking_enabled bool,
  disclose_pixel bool default true,
  csv_import_filename text, csv_row_count int, created_at

gardener_tracked_sends
  id, tracked_campaign_id (FK, cascade),
  audience_id (FK email_campaign_audience) nullable,  -- nullable: CSV recipients may not live in tenant audience
  recipient_email citext, recipient_email_hash text,  -- sha256(lower(email))
  recipient_name text, recipient_metadata jsonb,      -- extra CSV columns
  gmail_message_id, gmail_thread_id, subject,
  sent_at, first_opened_at, open_count int default 0,
  first_clicked_at, click_count int default 0,
  replied_at, reply_snippet text, reply_from_recipient bool,
  first_signup_at, first_customer_at,
  customer_plan text, customer_amount_cents int,
  last_swept_at, created_at
  UNIQUE (tracked_campaign_id, recipient_email_hash)

gardener_tracked_events
  id, send_id (FK, cascade),
  event_type text check in ('open','click','reply','signup','customer'),
  url, user_agent, ip inet,
  federation_app_id uuid null,
  metadata jsonb, occurred_at

gardener_federation_signup_orphans
  id, federation_app_id, email citext, email_hash text,
  external_user_id text, event_type text, metadata jsonb,
  received_at
```

- Column: `email_campaigns.federation_app_id uuid null`.
- GRANTs: `SELECT, INSERT, UPDATE ON ... TO authenticated`; `ALL TO service_role`. **No `anon`.**
- RLS: `USING (public.has_role(auth.uid(), 'gardener'))` on all four tables. Edge functions bypass via service role.
- Indexes: `federation_app_id`, `tracked_campaign_id`, `gmail_thread_id`, `recipient_email_hash`, partial `WHERE replied_at IS NULL`, partial `WHERE first_signup_at IS NULL`.

## 2. Edge functions

### `gardener-campaign-import-csv` (new)
- Auth: gardener role via `getClaims` + `has_role`.
- Body: `{ campaign_id, federation_app_id, csv_base64, filename }`.
- Parses CSV headers, requires `email`. Optional standard columns: `name`, `first_name`, `last_name`, `organization`, `role`, `city`, `state`, `notes`. All other columns land in `recipient_metadata`.
- Normalizes: lowercase email, trim, drops invalid/blank rows (reports counts), dedupes within CSV by `email_hash`, dedupes against existing rows in the same tracked campaign.
- Returns `{ rows_imported, rows_skipped, rows_invalid, sample: [...first 5] }` so the UI can show a dry-run preview.
- **Two-phase**: `dry_run:true` returns preview only; `dry_run:false` commits.
- Rows written to `gardener_tracked_sends` with `sent_at=null` (unsent placeholders); send phase updates them.

### `gmail-campaign-send` (modify)
When `gardener_tracking: { federation_app_id }` present:
1. Gardener role verified.
2. Upsert `gardener_tracked_campaigns`.
3. Recipient source: **either** existing `email_campaign_audience` **or** pre-imported `gardener_tracked_sends` where `sent_at IS NULL`. Composer picks one.
4. For each recipient row:
   - Rewrite `<a href="X">` → `${SUPABASE_URL}/functions/v1/track-click?sid={send_id}&u={base64url(X)}`.
   - **Propria URL enrichment**: any link whose host matches Propria's domains (`propria.land`, `propria.app`, `propria.lovable.app`) gets `?utm_source=cros_federation&utm_medium=email&utm_campaign={campaign_id}&cros_sid={send_id}` appended.
   - Append `<img src=".../track-open?sid={send_id}" width="1" height="1">` before `</body>`.
5. Send via Gmail API, write `gmail_message_id`, `gmail_thread_id`, `sent_at`.
6. Non-tracked path unchanged.

### `track-open` (new, public, verify_jwt=false)
Validate `sid`, insert event, update aggregates, dedupe within 10s, return 1×1 GIF, `Cache-Control: no-store`.

### `track-click` (new, public, verify_jwt=false)
Validate `sid` + `u` (must decode to http(s)), log event, 302 to decoded URL. Reject `javascript:`/`data:` → 400.

### `gardener-reply-sweep` (new, scheduled)
- Scope by `?age=fresh|aged`.
- Rows with `replied_at IS NULL AND sent_at IS NOT NULL AND sent_at > cutoff`.
- Uses each Gardener's stored Gmail OAuth token (reuses `gmail-sync` refresh helper).
- For each `gmail_thread_id` → `GET users/me/threads/{id}?format=metadata`. Inbound message from recipient after `sent_at` → mark `replied_at` + snippet.
- Time-bound 5 min, Continue-On-Fail, single deterministic envelope.

### `federation-signup-ingest` (new, HMAC-authed)
Propria POSTs on signup and again on paid conversion:
```
POST /functions/v1/federation-signup-ingest
Headers: X-Federation-App: propria, X-Signature: hmac_sha256(payload, propria_secret)
Body: { event_type:'signup'|'customer', external_user_id, email?, email_hash?,
        cros_sid?, occurred_at, plan?, amount_cents? }
```
Match order:
1. `cros_sid` → deterministic match to `gardener_tracked_sends.id` for that app.
2. `email_hash` (or hashed `email`) + `federation_app_id` + tracked send in last 60 days.
3. No match → `gardener_federation_signup_orphans` row.

Updates `first_signup_at` / `first_customer_at` + inserts `gardener_tracked_events(signup|customer)`. Idempotent by `(external_user_id, event_type, federation_app_id)`. HMAC secret stored via `add_secret` (`PROPRIA_FEDERATION_INGEST_SECRET`).

### pg_cron
```
gardener-reply-sweep-fresh — */15 * * * * — sent_at > now() - 7d
gardener-reply-sweep-aged  — 0 3 * * *    — sent_at between now()-30d and now()-7d
```

## 3. Operator UI (SCIENTIA)

Route: `/operator/scientia/federation-campaigns` — gardener-guarded.

**List page**
- Federation-app selector (defaults to Propria).
- Per-campaign card with narrative one-liners: "82 of 200 opened. 14 have written back. 6 have joined Propria. 2 became customers ($58)."

**Detail page**
- Rollup band: Sent · Opened · Clicked · Replied · Signed up · Customer.
- Funnel visualization (calm bars, not aggressive).
- Per-recipient table with status pills + last event.
- Event timeline drawer per recipient (all 5 event types).
- Orphan signups panel from `gardener_federation_signup_orphans` (Propria-scoped).

**Composer flow (gardener-only, new)**
- Toggle: "Track for CROS Federation" → federation-app dropdown (Propria pre-selected).
- CSV drop zone: drag-drop or file picker. Client parses headers, calls `gardener-campaign-import-csv` with `dry_run:true`, shows preview (row counts, sample, warnings).
- "Import & queue" button commits, then normal Gmail send path picks up the queued rows.
- Preview of the UTM template that will be appended to Propria links.

## 4. UX / Operator Liturgy
- "6 people have joined Propria." — never percentages first.
- Silence when nothing has happened.
- Warm badges, no red alerts. Sweep failures = quiet "waiting to hear back."

## 5. Tests (Deno, per project charter)

- **`gardener-campaign-import-csv`** — valid CSV → rows created; missing email column → 400; duplicate emails → dedupe count; malformed row → skipped + counted; non-gardener → 403; dry_run doesn't commit.
- **`track-open`** — valid → 200 GIF + event; unknown `sid` → 404; missing → 400; dedupe within 10s.
- **`track-click`** — valid → 302 to decoded URL; `javascript:` → 400; missing `u` → 400.
- **`gardener-reply-sweep`** — recipient reply fixture → marks; outbound only → not; malformed thread → warning + continue; time-bound.
- **`federation-signup-ingest`** — valid HMAC + `cros_sid` → attributes; valid HMAC + `email_hash` → matches; unmatched → orphan; bad signature → 401; replay → idempotent; `customer` after `signup` → upgrades same row.
- **`gmail-campaign-send`** — gardener + flag + CSV recipients → sends, HTML has pixel + rewritten links + Propria UTM/cros_sid; non-gardener + flag → 403; no flag → unchanged.

## 6. Delivery order (one pass)
1. Migration (4 tables, `email_campaigns.federation_app_id`, GRANTs, RLS)
2. `PROPRIA_FEDERATION_INGEST_SECRET` via `secrets--generate_secret` (then Propria team pastes it into their env)
3. `gardener-campaign-import-csv`, `track-open`, `track-click`, `gardener-reply-sweep`, `federation-signup-ingest` + tests
4. Modify `gmail-campaign-send` + tests
5. Deploy all edge functions
6. pg_cron jobs (via `supabase--insert` on `cron.schedule`)
7. Composer toggle + CSV drop zone (gardener-only)
8. Operator route + list/detail + orphans panel
9. Update `src/content/technicalDocumentation.ts`, HowTo, Gardener manuals with:
   - CSV format spec (columns, size limits)
   - Propria integration contract (URL params to read, POST payload to ingest endpoint)

## Caveats surfaced in-UI
- Gmail image proxy: opens are best-effort.
- Signups without `cros_sid` fall back to email-hash within 60 days; older → orphan.
- Gmail ~500/day sending cap.
- Optional pixel disclosure line (default on).
- CSV limit: 5MB / 5000 rows per campaign (tunable).

## Propria integration contract (docs deliverable)
1. On any inbound URL, read `cros_sid` query param and store on the session (cookie or session table) until signup completes.
2. On successful signup: POST to `federation-signup-ingest` with `event_type:'signup'`, `external_user_id`, `email`, `cros_sid` (if known).
3. On paid conversion: POST again with `event_type:'customer'`, `plan`, `amount_cents`.
4. Sign body with shared HMAC secret; verify TLS.

Opens/clicks/replies work day 1 regardless of Propria integration status; signup/customer light up once Propria wires the two POST calls.

## Non-goals (v1)
- Only Propria in the app selector (schema supports all federation apps; other apps added by populating `federation_app_id` and providing their HMAC secret).
- No cross-app cohort analysis.
- No unsubscribe rewriting (existing `campaign-unsubscribe-link` handles that).
- No A/B testing beyond existing `SubjectPerformanceTable`.
