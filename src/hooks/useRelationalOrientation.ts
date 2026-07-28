/**
 * useRelationalOrientation — Reads tenant orientation + richness defaults.
 *
 * WHAT: Exposes relational_orientation, people/partner richness levels, and auto_manage flag.
 * WHERE: EntityDetailLayout, Compass, Settings, Onboarding.
 * WHY: Drives adaptive UI density and compass weighting per tenant orientation.
 */

import { useTenant } from '@/contexts/TenantContext';

export type RelationalOrientation = 'human_focused' | 'institution_focused' | 'hybrid';

export function useRelationalOrientation() {
  const { tenant, isLoading } = useTenant();

  return {
    orientation: (tenant?.relational_orientation ?? 'institution_focused') as RelationalOrientation,
    peopleRichness: tenant?.people_richness_level ?? 1,
    partnerRichness: tenant?.partner_richness_level ?? 3,
    autoManageRichness: tenant?.auto_manage_richness ?? true,
    isLoading,
  };
}
