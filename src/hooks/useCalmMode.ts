/**
 * useCalmMode — Hook for reading/writing the operator's calm mode preference.
 *
 * WHAT: Reads operator_preferences.calm_mode from DB, falls back to true.
 * WHERE: Any operator component that needs to conditionally show calm language.
 * WHY: Allows per-user calm mode toggling while defaulting to ON.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useCalmMode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['operator-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('operator_preferences' as any)
        .select('calm_mode')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as any as { calm_mode: boolean }) || null;
    },
    enabled: !!user?.id,
  });

  const calmMode = prefs?.calm_mode ?? true; // default ON

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const newVal = !calmMode;
      const { error } = await supabase
        .from('operator_preferences' as any)
        .upsert({
          user_id: user.id,
          calm_mode: newVal,
          updated_at: new Date().toISOString(),
        } as any);
      if (error) throw error;
      return newVal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-preferences'] });
    },
  });

  return {
    calmMode,
    isLoading,
    toggleCalmMode: toggle.mutate,
    isToggling: toggle.isPending,
  };
}
