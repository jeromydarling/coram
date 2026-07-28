import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

export type DashboardMode = 'operational' | 'story';

export function useDashboardMode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Local cache for instant switching
  const [localMode, setLocalMode] = useState<DashboardMode | null>(null);

  const { data: serverMode, isLoading } = useQuery({
    queryKey: ['dashboard-mode', user?.id],
    queryFn: async (): Promise<DashboardMode> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('dashboard_mode')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return ((data as any)?.dashboard_mode as DashboardMode) || 'operational';
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30,
  });

  // Sync local cache when server data arrives
  useEffect(() => {
    if (serverMode && localMode === null) {
      setLocalMode(serverMode);
    }
  }, [serverMode, localMode]);

  const mutation = useMutation({
    mutationFn: async (mode: DashboardMode) => {
      const { error } = await supabase
        .from('profiles')
        .update({ dashboard_mode: mode } as any)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-mode', user?.id] });
    },
  });

  const setMode = (mode: DashboardMode) => {
    setLocalMode(mode);
    mutation.mutate(mode);
  };

  const mode: DashboardMode = localMode ?? serverMode ?? 'operational';

  return {
    mode,
    setMode,
    isLoading: isLoading && localMode === null,
  };
}
