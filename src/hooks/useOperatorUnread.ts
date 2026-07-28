/**
 * useOperatorUnread — Hook for operator unread notification count.
 *
 * WHAT: Fetches unread count for the bell icon badge.
 * WHERE: OperatorLayout header.
 * WHY: Calm awareness of pending notifications without polling aggressively.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOperatorUnread() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['operator-unread-count'],
    enabled: !!user?.id,
    refetchInterval: 60_000, // every 60s
    queryFn: async () => {
      const { count, error } = await supabase
        .from('operator_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('operator_user_id', user!.id)
        .eq('is_read', false);
      if (error) return 0;
      return count ?? 0;
    },
  });
}
