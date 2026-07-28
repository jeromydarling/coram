import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CallHistoryItem {
  id: string;
  notes: string | null;
  date: string;
  outcome: string | null;
  next_action: string | null;
  next_action_due: string | null;
}

export function useContactCallHistory(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-call-history', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data: calls, error } = await supabase
        .from('activities')
        .select('id, activity_date_time, notes, outcome, next_action, next_action_due')
        .eq('contact_id', contactId)
        .eq('activity_type', 'Call')
        .order('activity_date_time', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching call history:', error);
        return [];
      }

      return (calls || []).map(call => ({
        id: call.id,
        notes: call.notes,
        date: call.activity_date_time,
        outcome: call.outcome,
        next_action: call.next_action,
        next_action_due: call.next_action_due
      })) as CallHistoryItem[];
    },
    enabled: !!contactId
  });
}
