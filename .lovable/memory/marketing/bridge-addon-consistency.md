# Bridge-as-Add-On Consistency Checklist
Updated: 2026-02-21

## Purpose
Prevents drift where Bridge accidentally gets treated as a tier or Communio gets re-gated behind Bridge.

---

## A) Grep Targets (must match)

| Check | File | Expected |
|-------|------|----------|
| `PlanKey` type | `src/lib/features.ts` | `'core' \| 'insight' \| 'story'` only |
| `planHierarchy` array | `src/lib/features.ts` | `['core', 'insight', 'story']` — no `bridge` |
| `tierOrder` array | `src/pages/marketing/Pricing.tsx` | `['core', 'insight', 'story']` — no `bridge` |
| `tiers` object | `src/config/brand.ts` | Keys: `core`, `insight`, `story` only |
| Bridge in addons | `src/lib/addons.ts` | `key: 'bridge'` present in `ADD_ONS` array |
| Bridge in Stripe addons | `src/config/stripe.ts` | `bridge` in `stripeAddons`, NOT in `stripeProducts` |
| `communio_opt_in` in core | `src/lib/features.ts` | Present in `planFeatures.core` |
| `communio_opt_in` NOT in Bridge | `src/lib/addons.ts` | NOT in Bridge's `features` array |

## B) UI Checks

- [ ] `/pricing` shows exactly 3 tier cards (Core, Insight, Story)
- [ ] Bridge appears in the "Capacity Upgrades" add-on section
- [ ] Bridge bullets do NOT mention "Communio opt-in"
- [ ] Communio listed as included in Core tier (and inherited by all tiers)
- [ ] Comparison table shows Communio row with ✓ for all 3 tiers
- [ ] Checkout payload sends `bridge` under `addons`, not under `tiers`
- [ ] `FeatureGate` suggests "CROS Bridge™ add-on" when Relatio features are blocked

## C) Runtime Checks

- [ ] Create a Core tenant → Communio page accessible, opt-in toggle works
- [ ] Core tenant → Relatio page is gated (requires Bridge add-on)
- [ ] Core tenant → Migration harness is gated (requires Bridge add-on)
- [ ] `canUse('communio_opt_in', 'core')` returns `true`
- [ ] `canUse('relatio_marketplace', 'core')` returns `false`
- [ ] `canUse('relatio_marketplace', 'core', undefined, ['bridge'])` returns `true`

## D) Test Assertions

Located in `src/lib/__tests__/bridge-addon-consistency.test.ts`:

1. `planHierarchy` has exactly 3 entries, none is 'bridge'
2. `communio_opt_in` in core features
3. `communio_opt_in` NOT in any add-on
4. Bridge add-on exists with correct feature keys
5. `canUse('communio_opt_in', 'core')` → true
6. `canUse('relatio_marketplace', 'core')` → false
7. `canUse('relatio_marketplace', 'core', undefined, ['bridge'])` → true
