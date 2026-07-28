# Propria — which repo is Lovable actually deploying from?

**Discovered during:** 2026-07-27 metadata audit
**Status:** Non-blocking, but needs verification

## Three propria repos exist on jeromydarling

| Repo | Last push | Size | Has supabase/functions/? |
|---|---|---|---|
| `jeromydarling/propria` | 2026-06-29 | 595kb | ❌ No (bare skeleton) |
| `jeromydarling/propria-1e798e8e` | 2026-06-27 | 8.1MB | ❓ Not verified (audit didn't edit) |
| `jeromydarling/propria-aac78f12` | 2026-07-27 | 8.3MB | ✅ Yes (audit edited this one) |

## What canonical-repos doc says
`federation_canonical_repos.md` (dated 2026-06-10) lists `jeromydarling/propria-1e798e8e` as canonical.

## What the audit did
Edited `propria-aac78f12` (newer by 3 weeks, comparable size). Commit `dacebb5` on main adds `satellite_app: "propria"` to the Checkout Session.

## What you need to do (2 minutes)
1. Open Lovable → propria project → Project Settings → Git integration
2. Note which repo is bound (should show something like `jeromydarling/propria-XXX`)
3. Tell me the bound repo name

## Contingency
- If Lovable binds `propria-aac78f12` (newer, edited): ✅ You're done, hub routing will just work
- If Lovable binds `propria-1e798e8e` (older, not edited): I'll re-run the fix on that repo (1 commit)
- If Lovable binds `propria` (bare skeleton): Something is wrong with the Lovable setup — no Stripe code exists there

## Also worth cleaning up
Once we know the canonical one, the other two propria repos should be renamed with a `-archived-` prefix or deleted, so we don't ambiguously touch dead code in future audits.
