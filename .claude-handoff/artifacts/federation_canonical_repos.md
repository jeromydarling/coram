# CROS Federation — Canonical Repos (Lovable-Confirmed)

**Date**: 2026-06-10
**Source**: Lovable Project Settings > Git, after successful GitHub OAuth reconnect

## Confirmed canonical mapping

| App | Lovable project UUID | Connected repo | Branch | Status |
|---|---|---|---|---|
| thecros | 42b69f1f-... | `jeromydarling/thecros` | main | ✅ |
| vigilia | 0d768146-... | `jeromydarling/vigilia-ffa3c410` | main | ✅ |
| refugium | beea5107-... | `jeromydarling/refugium-a261235f` | main | ✅ |
| resurrectio | 2acb92a3-... | `jeromydarling/resurrectio-3d07f98c` | main | ✅ |
| transitus | 243c3ef3-... | `jeromydarling/transitus-be0eceba` | main | ✅ (SaaS-only, no Connect) |
| collegium | bb833a81-... | `jeromydarling/collegium-connect` | main | ⚠️ wrong repo was edited |
| hortus | bf0ababc-... | `jeromydarling/hortus-claude-s-garden` | main | ✅ |
| communis | 5f0a9ca7-... | `jeromydarling/communis-b47839b1` | main | ✅ |
| custodia | df86f202-... | `jeromydarling/custodia` | main | ✅ |
| rehearso | b5e51bb4-... | `jeromydarling/rehearso` | main | ✅ |
| bitoku | cdb5d886-... | `jeromydarling/bitoku-9fb5dffb` | main | ✅ rebound after disconnect/reconnect; old repos archived |

## Previously NO_GITHUB projects — now all CONNECTED
| App | Lovable UUID | GitHub repo | Status |
|---|---|---|---|
| propria | 0669c1b9-... | `jeromydarling/propria-1e798e8e` | ✅ auto-restored after OAuth refresh |
| fabrica | 57dbf3b0-... | `jeromydarling/fabrica-forge` | ✅ auto-restored after OAuth refresh |
| theschola | 24b6926c-... | `jeromydarling/theschola` | ✅ auto-restored after OAuth refresh |

## Pure-Cloudflare apps (no Lovable, no issue)
- directio → `jeromydarling/directio` (CF Workers)
- culina → `jeromydarling/culina` (CF Workers)
- sanctum → `jeromydarling/sanctum` (CF Workers)
- successio → `jeromydarling/successio` (CF Workers, no live Stripe surface)

## Issues to resolve

### 1. Collegium: wrong-repo edit problem
Lovable's collegium project is bound to `jeromydarling/collegium-connect` (last pushed 2026-06-03).
Our earlier session pushed Connect-fix commits to `jeromydarling/collegium` (last pushed 2026-06-08).
**Those commits never reached Lovable.** The `collegium` repo is orphaned — nothing is consuming it.

What we need to do:
- Re-apply our Connect webhook fix on top of `collegium-connect` instead
- Decide what to do with the orphaned `collegium` repo (archive, delete, or rename `collegium-connect` → `collegium` after archiving?)

### 2. Bitoku: RESOLVED — rebound to new Lovable-created repo

Lovable doesn't support reconnecting to existing repos — every Connect click creates a new hash-suffixed repo and Lovable populates it with the project's current code. During the disconnect/reconnect attempt, Lovable created two new repos (`bitoku-6d023ce6`, `bitoku-9fb5dffb`) each with the full bitoku codebase (identical commits to the original `jeromydarling/bitoku`).

**Final state**:
- ✅ `jeromydarling/bitoku-9fb5dffb` — active, Lovable-bound, contains full bitoku codebase
- 📁 `jeromydarling/bitoku` — archived (orphan original)
- 📁 `jeromydarling/bitoku-6d023ce6` — archived (unused duplicate)

No data loss — all three repos had identical commit history before archiving.

### 3. ~~Three NO_GITHUB projects~~ — RESOLVED
All three (propria, fabrica, theschola) auto-restored after the GitHub OAuth refresh propagated. No manual connect needed.

## Lovable Git status — final

Of 17 federation apps:
- ✅ **14 connected and verified** — thecros, vigilia, refugium, resurrectio, transitus (be0eceba), collegium (-connect), hortus (-claude-s-garden), communis (-b47839b1), custodia, rehearso, propria (-1e798e8e), fabrica (-forge), theschola, bitoku (with broken clone URL — see Issue 2)
- ✅ **3 Cloudflare-only** — directio, culina, sanctum

**Total resolved**: 16/17 fully clean. **1 anomaly**: bitoku's broken clone URL.

## Collegium status — RESOLVED

- Cherry-picked Connect-fix commit from orphan `jeromydarling/collegium` onto canonical `jeromydarling/collegium-connect`
- Renamed migration file to Lovable's `YYYYMMDDHHMMSS_<uuid>.sql` convention
- Pushed to `collegium-connect` main (now sha `4f166a6`)
- Archived orphan `jeromydarling/collegium` (read-only)
- Migration target tables (`tenant_stripe_connect`, `federation_apps`, `tenants`) confirmed present in `collegium-connect` migration history
- Lovable's Collegium project should pull this commit on next sync — at which point we can ask Lovable AI to apply it

---

## Amendment 2026-07-26 — Via Publica repo

**Correction:** `viapublica` was not previously listed. The naive lookup `jeromydarling/viapublica` returns an EMPTY stub (README only, 0 bytes of source, last pushed 2026-04-04).

**Canonical repo:** `jeromydarling/via-publica` (hyphenated), size 2716 kB, last pushed 2026-07-04.

- Contains full Sightengine/WalkScore/Census integrations
- Also mirrored inside personal monorepo `jeromydarling/jeromydarling` under `src/viapublica/`
- Any tooling that searches for `viapublica` (no hyphen) will find the empty stub and produce false negatives.

Recommend archiving or renaming the empty `jeromydarling/viapublica` stub to prevent future confusion.

---

## Amendment 2026-07-27 — The Great Nave + Cor Mundum discovered via Stripe webhook audit

Two active federation apps were not previously listed here. Both have live Stripe subscription billing and dedicated Supabase backends. Identified via Stripe webhook host lookup + GitHub code search.

| App | Lovable/repo status | GitHub repo | Supabase project | Stripe endpoint description | Status |
|---|---|---|---|---|---|
| The Great Nave | Lovable-connected (hash suffix) | `jeromydarling/thegreatnave-49ebb963` | `betonqvgbnuqjeyutzqh.supabase.co` | (none — needs to add "thegreatnave platform") | ✅ active dev to 2026-07-24 |
| Cor Mundum | Lovable-connected (bare name) | `jeromydarling/cormundum` | `lycubwceblanwyxfcojm.supabase.co` | "Cor Mundum app" | ✅ active dev to 2026-06-29 |

**Notes:**
- The Great Nave: opera/ballet/classical-music subscription content app. Bare `jeromydarling/thegreatnave` is PLANNING DOCS ONLY (like viapublica pattern) — real code lives at hash-suffixed repo.
- Cor Mundum: Catholic spiritual formation / journaling / spiritual-direction app. Thematically aligned with sanctum/communis/refugium.
- Neither has a custom domain configured yet — served from Lovable default URLs.
- Both need entries added to any hub-and-spoke Stripe routing table when migration proceeds.
