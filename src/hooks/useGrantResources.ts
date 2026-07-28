import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GrantResource {
  id: string;
  grant_id: string;
  resource_type: string;
  label: string;
  url: string | null;
  resource_date: string | null;
  resource_date_end: string | null;
  description: string | null;
  source: string;
  run_id: string | null;
  created_at: string;
}

export function useGrantResources(grantId: string | null) {
  return useQuery({
    queryKey: ['grant-resources', grantId],
    queryFn: async () => {
      if (!grantId) return [];
      const { data, error } = await supabase
        .from('grant_resources')
        .select('*')
        .eq('grant_id', grantId)
        .order('resource_type')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GrantResource[];
    },
    enabled: !!grantId,
  });
}
