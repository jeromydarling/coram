# Architecture Guardrails — Phase 8U

## Overview

Phase 8U introduced systemic guardrails to prevent silent architectural drift across entitlements, feature gating, selector contracts, and NRI transparency.

All guardrails surface ONLY in Operator Nexus QA — no tenant-facing changes.

---

## Guardrail Modules

### 1. Entitlement Integrity (`src/lib/guardrails.ts`)
- Verifies plan hierarchy is exactly 3 tiers (Core/Insight/Story)
- Confirms Bridge is not recognized as a plan tier
- Asserts Communio base features available at Core without add-ons
- Validates cumulative tier inheritance (Core ⊂ Insight ⊂ Story)

### 2. Selector Contract Registry (`src/lib/qa/selectorRegistry.ts`)
- Authoritative list of all `data-testid` values
- QA runner should reference this registry, never raw selectors
- Includes nav selectors, nav groups, and page-level selectors
- `getSelectorStats()` returns counts for health reporting

### 3. Add-on Registry Sync (`src/lib/guardrails.ts`)
- Validates all add-ons define feature keys
- Confirms Bridge add-on does NOT gate Communio features
- Detects duplicate feature keys across add-ons

### 4. NRI Transparency (`src/components/nri/NriInsightDrawer.tsx`)
- "Why am I seeing this?" drawer on every NRI story signal
- Shows evidence links, confidence label, and human override (dismiss)
- Integrated into StorySignalsCard on the Command Center

---

## Operator Nexus QA Dashboard

The QA page (`/operator/nexus/qa`) now includes an **Architecture Guardrails** section showing:

- ✔ Entitlement Integrity (3 checks)
- ✔ Selector Contract Health (2 checks)
- ✔ Add-on Registry Sync (3 checks)
- ✔ NRI Transparency (2 checks)

Each check shows pass/fail/warn with detail text.

---

## Grep Targets (Regression Prevention)

```bash
# Plan hierarchy must be 3 tiers
grep -n "planHierarchy" src/lib/features.ts
# Should show: ['core', 'insight', 'story']

# Bridge must not be in planFeatures
grep -n "'bridge'" src/lib/features.ts
# Should return nothing

# Bridge add-on must not contain communio
grep -n "communio" src/lib/addons.ts
# Should NOT appear in Bridge's features array

# Communio keys must be in Core
grep -n "communio_opt_in" src/lib/features.ts
# Should appear under core planFeatures
```

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/qa/selectorRegistry.ts` | Created | Authoritative testid registry |
| `src/lib/guardrails.ts` | Created | Client-side architecture validators |
| `src/components/nri/NriInsightDrawer.tsx` | Created | NRI transparency drawer |
| `src/components/dashboard/StorySignalsCard.tsx` | Modified | Added NRI drawer integration |
| `src/pages/operator/nexus/OperatorNexusQA.tsx` | Modified | Added Architecture Guardrails section |
