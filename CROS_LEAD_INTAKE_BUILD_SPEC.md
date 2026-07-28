# CROS Universal Lead Intake — Build Spec

> **Status:** Layer 1 of the CROS Federation plan.
> **Sibling spec:** `CROS_FEDERATION_BUILD_SPEC.md` (the master consolidation roadmap).
> **Owner:** Jeromy.
> **Last edited:** 2026-04-26.

## Purpose (one paragraph)

Every CROS-family app posts marketing/demo/waitlist/contact form submissions to a single endpoint in CROS. CROS persists them with full source attribution (which app, which page, which UTM, which variant) into `public.inbound_leads`, and surfaces them in the Operator Console under **Leads by App**. Operators see every lead from every app in one screen, with conversion rate by source. This is the first concrete piece of the CROS Federation: collapsing operator workflows from 17 apps into one console.

## Contract

### Endpoint

```
POST  https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/public-leads-intake
Content-Type: application/json
```

### Request body

```jsonc
{
  // ── Required ─────────────────────────────────────────────────────────
  "source_app":   "hortus",          // slug; must match watchtower projects.json
  "name":         "Jane Doe",
  "email":        "jane@example.com",

  // ── Highly recommended ───────────────────────────────────────────────
  "lead_kind":    "demo",            // demo | waitlist | contact | feedback | partner | beta
  "form_variant": "hero",            // your label for A/B variants on the same form
  "source_url":   "https://hortusapp.com/demo?utm_source=newsletter",
  "source_page":  "/demo",
  "referrer":     "https://news.example.com/post/123",

  // ── Optional, contextual ─────────────────────────────────────────────
  "organization": "Sunset Community Garden",
  "phone":        "+1-555-1234",
  "message":      "We'd like a demo for our 12 raised beds.",
  "interest":     "raised-bed planning",
  "archetype":    "community-garden-coordinator",

  // ── UTMs (read by the form helper from window.location) ──────────────
  "utm_source":   "newsletter",
  "utm_medium":   "email",
  "utm_campaign": "spring-2026",
  "utm_term":     null,
  "utm_content":  null,

  // ── Free-form, app-specific ──────────────────────────────────────────
  "extra": {
    "garden_size_sqft": 1200,
    "zone": "5a"
  },

  // ── Spam guard ───────────────────────────────────────────────────────
  "honeypot": ""                     // must be empty
}
```

### Responses

| Status | Body                                                                 | Meaning                              |
|--------|----------------------------------------------------------------------|--------------------------------------|
| 201    | `{ ok:true, data:{ id, deduped:false, accepted:true, flagged_spam } }` | Stored                               |
| 200    | `{ ok:true, data:{ id:null, deduped:true, accepted:true } }`         | Same email + same app + same UTC day |
| 200    | `{ ok:true, data:{ id:null, deduped:false, accepted:false } }`       | Honeypot tripped (silent)            |
| 400    | `{ ok:false, error, code:"VALIDATION_ERROR" }`                       | Bad input                            |
| 401    | `{ ok:false, error, code:"UNAUTHORIZED" }`                           | Wrong intake secret (only if set)    |
| 429    | `{ ok:false, error, code:"RATE_LIMITED" }`                           | >5 requests/min from IP              |
| 500    | `{ ok:false, error, code:"INTERNAL_ERROR" }`                         | Server error                         |

### Authorization

- **Public endpoint** — `verify_jwt = false`. Anonymous browsers can call it.
- **Optional shared secret** — set `LEADS_INTAKE_SECRET` in Supabase secrets to require an `x-cros-intake-secret: <value>` header. Useful if you ever need to lock it down to known origins.
- **Rate limit** — 5 submissions/minute/IP at the function layer. Tune `rateLimitPublic` if needed.
- **Origin allowlist** — `_shared/cors.ts` lists every CROS-family origin. New apps must add theirs in the same PR that wires up the form.

## Integrating a satellite app

### Option A — React (most apps)

```tsx
import { CrosLeadForm } from '@/components/feedback/CrosLeadForm';

export function DemoSection() {
  return (
    <CrosLeadForm
      sourceApp="hortus"
      leadKind="demo"
      formVariant="hero"
      fields={['name', 'email', 'organization', 'message']}
      submitLabel="Get a demo"
    />
  );
}
```

The component is one file (`src/components/feedback/CrosLeadForm.tsx`). Copy it into each satellite repo as-is, or publish it to a shared package later.

### Option B — Vanilla HTML (any app, any framework)

```html
<div data-cros-lead-form
     data-source-app="hortus"
     data-lead-kind="demo"
     data-form-variant="hero"
     data-fields="name,email,organization,message"
     data-submit-label="Get a demo"></div>
<script src="https://thecros.app/embed/cros-lead-form.js" async defer></script>
```

The drop-in lives at `public/embed/cros-lead-form.js` in the CROS repo, served straight from the hosting layer.

### Option C — Custom curl / server-to-server

```bash
curl -X POST https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/public-leads-intake \
  -H "Content-Type: application/json" \
  -d '{"source_app":"hortus","name":"Test","email":"test@example.com","lead_kind":"demo"}'
```

## Schema (what gets persisted)

`public.inbound_leads` (extended in migration `20260426153953_universal_lead_intake.sql`):

| Column                  | Type        | Notes                                                                   |
|-------------------------|-------------|-------------------------------------------------------------------------|
| id                      | uuid        | PK                                                                      |
| name, email             | text        | required, length-capped                                                 |
| organization, message   | text        | optional                                                                |
| phone, interest         | text        | optional                                                                |
| archetype               | text        | persona / form-context label                                            |
| **source_app**          | text        | watchtower slug — the federation key                                    |
| **source_url**          | text        | full URL at submit time                                                 |
| source_page             | text        | pathname at submit time                                                 |
| form_variant            | text        | A/B label                                                               |
| utm_*                   | text        | utm_source / medium / campaign / term / content                         |
| referrer                | text        | document.referrer                                                       |
| user_agent              | text        | first 512 chars                                                         |
| ip_hash                 | text        | sha256(ip + day) — stored, IP itself is not                             |
| **lead_kind**           | text        | demo / waitlist / contact / feedback / partner / beta                   |
| extra                   | jsonb       | free-form, app-specific                                                 |
| **dedupe_key**          | text        | sha256(email + source_app + UTC day) — unique-indexed                   |
| **status**              | text        | new / triaged / routed / replied / won / lost / spam                    |
| routed_tenant_id        | uuid        | when an operator assigns the lead to a tenant                           |
| routed_at               | timestamptz | when                                                                    |
| converted_contact_id    | uuid        | links to public.contacts when the lead becomes a real contact           |
| notes                   | text        | operator notes                                                          |
| created_at, updated_at  | timestamptz | system                                                                  |

A view `public.operator_leads_by_app` rolls these up by `source_app`. It powers the **Leads by App** tab in OperatorConsole.

## Operator workflow

1. Lead arrives → row in `inbound_leads` with `status='new'`, `source_app` set.
2. OperatorConsole → **Leads by App** tab shows portfolio rollup; per-app drill-down planned for Phase 1.1.
3. Operator triages in OperatorConsole → marks `routed`, sets `routed_tenant_id`.
4. When a real conversation starts, operator promotes to `public.contacts` (sets `converted_contact_id`).
5. The view's `conversion_pct` recalculates automatically.

## Roll-out plan (all 17 apps)

The companion file `LEAD_INTAKE_ROLLOUT_CHECKLIST.md` lists each app and the integration entry point. We're rolling out in three waves:

- **Wave 1** (this PR): retire schola's `schola-demo-lead-webhook`, point its forms at the new endpoint. Prove the pattern.
- **Wave 2**: apps with existing signup/contact pages (Hortus, Communis, Refugium, Bitoku, Rehearso, Vrtmethod, Fabrica Forge, Heritage Kitchen, Via Publica). Drop in the React component.
- **Wave 3**: apps without a current form (Vigilia, Transitus, Resurrectio, Propria, Cormundum, Catholic Insurance). Add a marketing CTA with the vanilla embed.

## Security review

- Public endpoint with strict CORS allowlist.
- Body size capped by Supabase edge runtime; per-field length caps enforced before insert.
- Honeypot + bot-UA heuristics → flagged as `spam`, still stored for audit.
- Rate limiting per-IP (in-memory, per instance) at the function layer.
- Optional `LEADS_INTAKE_SECRET` for tightened deployments.
- IP itself is never stored — only sha256(ip + day) for fraud-pattern analysis.
- RLS: anon can INSERT, only admins SELECT/UPDATE.

## Open questions

- [ ] Add Supabase-level dedupe + auto-spam ML once volume justifies it (probably > 50/week per app).
- [ ] Auto-route leads to a tenant when `extra` includes a `tenant_hint` field?
- [ ] Webhook out to a Slack / email digest when `lead_kind in ('partner','beta')`? Probably yes once the funnel matters.

---
*This spec follows the format of `CRESCERE_BUILD_SPEC.md` and `GARDEN_PULSE_BUILD_SPEC.md` for consistency with prior CROS phases.*
