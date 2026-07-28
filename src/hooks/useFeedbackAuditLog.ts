import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FeedbackAuditEntry {
  id: string;
  feedback_id: string;
  action: string;
  previous_value: string | null;
  new_value: string | null;
  performed_by: string;
  created_at: string;
}

export function useFeedbackAuditLog(feedbackId: string | null) {
  return useQuery({
    queryKey: ['feedback-audit-log', feedbackId],
    queryFn: async () => {
      if (!feedbackId) return [];
      
      const { data, error } = await supabase
        .from('feedback_audit_log')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FeedbackAuditEntry[];
    },
    enabled: !!feedbackId,
  });
}
