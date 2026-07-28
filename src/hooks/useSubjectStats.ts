import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SubjectStat {
  id: string;
  subject: string;
  sent_count: number;
  failed_count: number;
  last_used_at: string;
}

export function useSubjectStats() {
  return useQuery<SubjectStat[]>({
    queryKey: ['campaign-subject-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_subject_stats')
        .select('id, subject, sent_count, failed_count, last_used_at')
        .order('last_used_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as SubjectStat[];
    },
    staleTime: 30_000,
  });
}
