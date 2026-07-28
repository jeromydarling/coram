/**
 * useTenantLens — Fetches the current user's tenant-scoped lens + settings.
 *
 * WHAT: Reads from tenant_user_lenses and tenant_settings for the active tenant.
 * WHERE: Consumed by Sidebar, Header, ViewModeContext for lens-aware rendering.
 * WHY: Dual-write system — lens is tenant-scoped while profiles.ministry_role is the global fallback.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { getEffectiveLens, type LensRole } from '@/lib/ministryRole';

export function useTenantLens() {
  const { user, isSteward, profile } = useAuth();
  const { tenant } = useTenant();

  const { data: lensRow, isLoading: lensLoading } = useQuery({
    queryKey: ['tenant-user-lens', tenant?.id, user?.id],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return null;
      const { data } = await supabase
        .from('tenant_user_lenses')
        .select('lens, full_workspace_enabled')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return data as unknown as { lens: string; full_workspace_enabled: boolean } | null;
    },
    enabled: !!tenant?.id && !!user?.id,
  });

  const { data: tenantSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['tenant-settings', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data } = await supabase
        .from('tenant_settings')
        .select('default_lens, default_view_mode, calm_mode_default, allow_full_workspace_toggle')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      return data as unknown as {
        default_lens: string;
        default_view_mode: string;
        calm_mode_default: boolean;
        allow_full_workspace_toggle: boolean;
      } | null;
    },
    enabled: !!tenant?.id,
  });

  const effectiveLens: LensRole = getEffectiveLens(isSteward, lensRow, profile);
  const fullWorkspaceEnabled = lensRow?.full_workspace_enabled ?? true;
  const allowFullWorkspaceToggle = tenantSettings?.allow_full_workspace_toggle ?? true;

  return {
    lens: effectiveLens,
    fullWorkspaceEnabled: fullWorkspaceEnabled && allowFullWorkspaceToggle,
    tenantSettings,
    isLoading: lensLoading || settingsLoading,
  };
}
