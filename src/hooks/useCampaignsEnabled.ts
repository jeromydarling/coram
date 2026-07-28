/**
 * useCampaignsEnabled — Checks if the Relatio Campaigns™ add-on is active.
 *
 * WHAT: Returns whether the current tenant has purchased the campaigns add-on.
 * WHERE: Used in sidebar gating, route guards, and campaign UI.
 * WHY: Campaigns are a paid add-on; UI must reflect entitlement state.
 */
import { useEntitlements } from '@/hooks/useEntitlements';

export function useCampaignsEnabled() {
  const { entitlements, isLoading } = useEntitlements();

  return {
    enabled: entitlements.campaigns_enabled ?? false,
    loading: isLoading,
  };
}
