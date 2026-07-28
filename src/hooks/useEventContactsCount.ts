import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventContactStats {
  count: number;
  withOpportunity: number;
  conversionRate: number;
}

export function useEventContactsCount() {
  return useQuery({
    queryKey: ['event-contacts-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('met_at_event_id, opportunity_id')
        .not('met_at_event_id', 'is', null);
      
      if (error) throw error;
      
      // Count contacts and conversions per event
      const stats: Record<string, EventContactStats> = {};
      data?.forEach(contact => {
        if (contact.met_at_event_id) {
          if (!stats[contact.met_at_event_id]) {
            stats[contact.met_at_event_id] = { count: 0, withOpportunity: 0, conversionRate: 0 };
          }
          stats[contact.met_at_event_id].count++;
          if (contact.opportunity_id) {
            stats[contact.met_at_event_id].withOpportunity++;
          }
        }
      });
      
      // Calculate conversion rates
      Object.keys(stats).forEach(eventId => {
        const s = stats[eventId];
        s.conversionRate = s.count > 0 ? (s.withOpportunity / s.count) * 100 : 0;
      });
      
      return stats;
    }
  });
}

export function useContactsByEvent(eventId: string | null) {
  return useQuery({
    queryKey: ['contacts-by-event', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          slug,
          name,
          title,
          email,
          opportunity_id,
          opportunities!contacts_opportunity_id_fkey (organization)
        `)
        .eq('met_at_event_id', eventId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!eventId
  });
}
