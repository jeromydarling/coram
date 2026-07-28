/**
 * useCompassUserState — DB-persisted compass dismissals + auto-open cooldown.
 *
 * WHAT: Replaces localStorage-only compass state with user-scoped DB persistence.
 * WHERE: TodaysMovementSection (dismissals), useCompassAutoOpen (cooldown).
 * WHY: Cross-device consistency — dismissing a nudge on desktop reflects on mobile.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

interface CompassUserState {
  dismissed_nudge_ids: string[];
  dismissed_date: string;
  last_auto_open_at: string | null;
}

// Calendar-day logic: auto-open once per calendar day (user's local timezone)

export function useCompassUserState() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const key = ['compass-user-state', user?.id, tenantId];

  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!user?.id && !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row } = await supabase
        .from('compass_user_state')
        .select('dismissed_nudge_ids, dismissed_date, last_auto_open_at')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      return row as CompassUserState | null;
    },
  });

  // Dismissed IDs — only valid for today
  const dismissedIds: Set<string> = new Set(
    data && data.dismissed_date === today ? (data.dismissed_nudge_ids || []) : []
  );

  const dismissNudge = useMutation({
    mutationFn: async (nudgeId: string) => {
      const currentIds = data?.dismissed_date === today ? (data.dismissed_nudge_ids || []) : [];
      const nextIds = [...new Set([...currentIds, nudgeId])];
      await supabase
        .from('compass_user_state')
        .upsert({
          user_id: user!.id,
          tenant_id: tenantId!,
          dismissed_nudge_ids: nextIds,
          dismissed_date: today,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,tenant_id' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const canAutoOpen = (() => {
    if (!data?.last_auto_open_at) return true;
    // Only auto-open once per calendar day (local timezone)
    const lastOpenDate = new Date(data.last_auto_open_at).toLocaleDateString();
    const todayDate = new Date().toLocaleDateString();
    return lastOpenDate !== todayDate;
  })();

  const recordAutoOpen = useMutation({
    mutationFn: async () => {
      await supabase
        .from('compass_user_state')
        .upsert({
          user_id: user!.id,
          tenant_id: tenantId!,
          last_auto_open_at: new Date().toISOString(),
          dismissed_nudge_ids: data?.dismissed_date === today ? (data.dismissed_nudge_ids || []) : [],
          dismissed_date: today,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,tenant_id' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    dismissedIds,
    dismissNudge: dismissNudge.mutate,
    canAutoOpen,
    recordAutoOpen: recordAutoOpen.mutate,
    isLoading,
  };
}
