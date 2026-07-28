import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { EmailTaskSuggestion } from './useEmailTaskSuggestions';

export interface DashboardEmailSuggestion extends EmailTaskSuggestion {
  organization?: string;
  metro_name?: string;
}

/**
 * Fetches pending/accepted email task suggestions for the current user
 * across all opportunities, ordered by due_date then created_at.
 */
export function useDashboardEmailSuggestions(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-email-suggestions', user?.id, limit],
    queryFn: async (): Promise<DashboardEmailSuggestion[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('email_task_suggestions')
        .select(`
          *,
          opportunities(organization, metro_id, metros(metro))
        `)
        .eq('created_by', user.id)
        .in('status', ['pending', 'accepted'])
        .order('suggested_due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return ((data || []) as any[]).map((row) => ({
        ...row,
        organization: row.opportunities?.organization ?? 'Unknown org',
        metro_name: row.opportunities?.metros?.metro ?? undefined,
      }));
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
