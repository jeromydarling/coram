import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserAlert {
  id: string;
  user_id: string;
  alert_type: string;
  ref_type: string | null;
  ref_id: string | null;
  message: string;
  created_at: string;
  read_at: string | null;
}

export function useUserAlerts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-alerts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as UserAlert[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useUnreadAlertCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-alerts-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('user_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('user_alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-alerts'] });
      qc.invalidateQueries({ queryKey: ['user-alerts-count'] });
    },
  });
}

export function useMarkAllAlertsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('user_alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-alerts'] });
      qc.invalidateQueries({ queryKey: ['user-alerts-count'] });
    },
  });
}
