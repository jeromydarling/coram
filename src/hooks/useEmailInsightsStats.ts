import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StatsResult {
  success: boolean;
  countsByStatus: Record<string, number>;
  windowDays: number;
}

export function useEmailInsightsStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['email-insights-stats', user?.id],
    queryFn: async (): Promise<StatsResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profunda-ai?mode=stats`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'GMAIL_NOT_CONNECTED') {
          return {
            success: true,
            countsByStatus: {},
            windowDays: 90,
          };
        }
        throw new Error(errorData.message || 'Failed to fetch stats');
      }
      
      const data = await response.json();
      
      return data as StatsResult;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });
}
