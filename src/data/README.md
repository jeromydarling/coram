# src/data — Data-layer hooks (Phase B foundation)

This directory is the destination for every TanStack Query hook that talks to
Supabase. The goal of Phase B is to move all `supabase.*` calls out of
components and pages and into per-domain hooks here, so that:

1. Components stay declarative and easy to test (no Supabase mocking).
2. Query keys live in one place (`src/lib/queryKeys.ts`) and invalidations
   stay correct across the app.
3. The runtime cast from raw Supabase rows to our domain types goes through
   `supabaseRow` / `supabaseRows` in `src/lib/supabaseRow.ts` — never `as any`.

## Layout

```
src/data/
  <domain>/
    useThing.ts          ← queries + mutations for one resource
    useThing.test.ts     ← optional vitest covering the queryFn logic
```

Domains mirror the keys in `queryKeys`: `people/`, `opportunities/`,
`events/`, `activities/`, `grants/`, `volunteers/`, `provisions/`,
`projects/`, `reflections/`, `metros/`, `campaigns/`, `testimonium/`,
`tenant/`, `auth/`, `operator/`, `federation/`, `marketing/`.

## Conventions

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { supabaseRows } from "@/lib/supabaseRow";
import { useTenant } from "@/contexts/TenantContext";

export function useThings() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: queryKeys.things.list(tenantId ?? ""),
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("things")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return supabaseRows<Thing>(data);
    },
  });
}
```

Rules:

- **Always** use `queryKeys.*` helpers. Never hand-build `['things', tenantId, ...]`.
- **Always** use `supabaseRow` / `supabaseRows` instead of `as any`.
- **Always** scope to `tenantId` for tenant-owned resources and bail when missing.
- **Never** import from `@/integrations/supabase/client` outside `src/data/**`,
  `src/integrations/**`, `src/contexts/AuthContext.tsx`, edge function callers,
  or admin/operator utilities. An ESLint rule will enforce this in Phase E.

## Migration status

This is the foundation drop. Hooks under `src/hooks/` are being migrated
incrementally; new hooks should be added here, and refactors of existing
hooks should adopt `queryKeys` + `supabaseRows` in place before being moved.
