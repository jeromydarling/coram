/**
 * useMetroIntelligence — Returns whether the current tenant has Metro Intelligence enabled.
 *
 * WHAT: Checks tenant.civitas_enabled flag (internally stored as civitas_enabled).
 * WHERE: Sidebar gating, route guards, component-level metro UI hiding.
 * WHY: Metro Intelligence is a progressive-reveal capability. Single-region tenants
 *       don't need metro-level views, but the data layer remains intact.
 *
 * NOTE: homeMetroId is now derived from tenant_territories.is_home via useHomeTerritory.
 *       This field is kept for backward compatibility but consumers should migrate to useHomeTerritory.
 */
import { useTenant } from '@/contexts/TenantContext';

export function useMetroIntelligence() {
  const { tenant, isLoading } = useTenant();

  return {
    enabled: (tenant as any)?.civitas_enabled ?? false,
    /** @deprecated Use useHomeTerritory() or useHomeMetroId() instead */
    homeMetroId: (tenant as any)?.home_metro_id ?? null,
    loading: isLoading,
  };
}
