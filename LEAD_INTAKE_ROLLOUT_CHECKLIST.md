# Lead Intake Rollout Checklist

Per-app status of the Layer 1 universal lead-intake migration. Update boxes as each ships.

## Wave 1 — pattern proof

- [ ] **theschola** — retire `supabase/functions/schola-demo-lead-webhook` and point `IntakePage.tsx` at `<CrosLeadForm sourceApp="theschola" />`. This is the most-trafficked existing demo form; it proves the pattern.

## Wave 2 — apps with existing signup/contact pages (drop-in replacement)

- [ ] **hortus** — `src/pages/auth/Signup.tsx`: add a marketing demo CTA above the auth form using `<CrosLeadForm sourceApp="hortus" leadKind="demo" />`. Slug confirmed: `hortus`.
- [ ] **communis** — replace `src/pages/ContactPage.tsx` form body with `<CrosLeadForm sourceApp="communis" leadKind="contact" fields={['name','email','organization','message']} />`.
- [ ] **refugium** — `src/pages/marketing/Contact.tsx`: same pattern as communis. `sourceApp="refugium"`, `leadKind="contact"`.
- [ ] **bitoku** — `src/pages/Microsite.tsx` already has lead intent; add `<CrosLeadForm sourceApp="bitoku" leadKind="waitlist" formVariant="microsite" />` to the hero.
- [ ] **rehearso** — `src/components/scheduling/WaitlistManager.tsx` is end-user-facing; **add** a separate marketing waitlist form using `<CrosLeadForm sourceApp="rehearso" leadKind="waitlist" />` on the marketing landing page.
- [ ] **vrtmethod** — `src/components/vrt/SignupSection.tsx`: replace the form body with `<CrosLeadForm sourceApp="vrtmethod" leadKind="contact" />`.
- [ ] **fabrica-forge** — add `<CrosLeadForm sourceApp="fabrica-forge" leadKind="demo" />` to the marketing landing.
- [ ] **heritage-kitchen** — no current form; add a "Be notified when we launch" waitlist with `<CrosLeadForm sourceApp="heritage-kitchen" leadKind="waitlist" />`.
- [ ] **via-publica** — add the vanilla embed (`/embed/cros-lead-form.js`) since the site is mostly static. `data-source-app="via-publica"`, `data-lead-kind="contact"`.

## Wave 3 — apps without a current form

- [ ] **vigilia** — add a small "Request a demo" CTA. `sourceApp="vigilia"`, `leadKind="demo"`.
- [ ] **transitus** — same. `sourceApp="transitus"`.
- [ ] **resurrectio** — same. `sourceApp="resurrectio"`.
- [ ] **propria** — same. `sourceApp="propria"`.
- [ ] **cormundum** — `src/components/gardener/leads/LeadsTab.tsx` is operator-facing — leave alone. Add a marketing form: `sourceApp="cormundum"`, `leadKind="demo"`.
- [ ] **catholic-insurance** — add `sourceApp="catholic-insurance"`, `leadKind="contact"`.
- [ ] **thecros** itself — its existing demo CTAs should also flow through this endpoint with `sourceApp="thecros"`, so the rollup includes self-traffic.

## Per-app integration steps (same for every app)

1. Copy `src/components/feedback/CrosLeadForm.tsx` from the CROS repo into the satellite repo at the same path.
2. (Optional) Set `VITE_CROS_INTAKE_URL=https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/public-leads-intake` in the satellite's `.env`.

   **Do not use `https://thecros.lovable.app/functions/v1/...`** — that URL 307-redirects to `thecros.app`, which serves the SPA shell (no edge function, no CORS headers). Browsers silently fail the request. Use the Supabase Functions origin directly.
3. Replace the existing form body with `<CrosLeadForm sourceApp="<slug>" ... />`.
4. Ensure the satellite's deployed origin appears in `_shared/cors.ts` allowlist on CROS. (All current origins already present.)
5. Smoke-test: submit, then watch OperatorConsole → Leads by App → row count tick up for that slug.
6. Open a PR titled `feat: route demo leads through CROS universal intake (<slug>)`.

## Tracking

Once a wave is fully merged, run a quick check:

```sql
-- In CROS Supabase SQL editor
SELECT * FROM operator_leads_by_app ORDER BY last_lead_at DESC NULLS LAST;
```

Every active app should show a non-zero `last_lead_at` within a week of integration.
