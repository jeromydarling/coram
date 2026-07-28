/**
 * useCompanionMode — Read/write the user's Narrative Companion Mode preference.
 *
 * WHAT: Reads user_preferences.companion_mode_enabled, respects tenant override.
 * WHERE: User menu toggle, Settings card, CompanionTray.
 * WHY: Central source of truth for whether micro-guidance should render.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export function useCompanionMode() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  // Tenant-level settings
  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-companion-settings', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_settings')
        .select('companion_mode_default, companion_mode_allow_users, compliance_posture')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      return data ?? { companion_mode_default: false, companion_mode_allow_users: true, compliance_posture: 'standard' };
    },
  });

  // User-level preference
  const { data: userPrefs, isLoading } = useQuery({
    queryKey: ['user-companion-prefs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('companion_mode_enabled, companion_mode_dismissed_until')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const allowedByTenant = tenantSettings?.companion_mode_allow_users ?? true;
  const isHipaaSensitive = tenantSettings?.compliance_posture === 'hipaa_sensitive';

  // Effective enabled state
  const enabled = allowedByTenant && (userPrefs?.companion_mode_enabled ?? false);

  // Check snooze
  const snoozedUntil = userPrefs?.companion_mode_dismissed_until;
  const isSnoozed = snoozedUntil ? new Date(snoozedUntil) > new Date() : false;

  const isActive = enabled && !isSnoozed;

  const toggle = useMutation({
    mutationFn: async (newVal: boolean) => {
      if (!user?.id || !tenantId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          tenant_id: tenantId,
          companion_mode_enabled: newVal,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-companion-prefs', user?.id] });
    },
  });

  const snoozeForToday = useMutation({
    mutationFn: async () => {
      if (!user?.id || !tenantId) throw new Error('Not authenticated');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          tenant_id: tenantId,
          companion_mode_enabled: true,
          companion_mode_dismissed_until: tomorrow.toISOString(),
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-companion-prefs', user?.id] });
    },
  });

  return {
    enabled,
    isActive,
    isLoading,
    allowedByTenant,
    isHipaaSensitive,
    isSnoozed,
    toggle: (val: boolean) => toggle.mutate(val),
    isToggling: toggle.isPending,
    snoozeForToday: () => snoozeForToday.mutate(),
    isSnoozingToday: snoozeForToday.isPending,
  };
}
