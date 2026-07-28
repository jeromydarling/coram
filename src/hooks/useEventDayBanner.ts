/**
 * Hook to detect if today is a conference day
 * 
 * Returns conferences where today's date falls between event_date and end_date (inclusive)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, parseISO } from 'date-fns';

interface EventDayEvent {
  id: string;
  event_name: string;
  event_date: string;
  end_date: string | null;
  slug: string | null;
  city: string | null;
  metros?: { metro: string } | null;
}

export function useEventDayBanner() {
  return useQuery({
    queryKey: ['event-day-banner'],
    queryFn: async (): Promise<EventDayEvent[]> => {
      // Fetch conferences only
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, end_date, slug, city, metros(metro)')
        .eq('is_conference', true)
        .order('event_date', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      const today = startOfDay(new Date());

      // Filter to events where today falls within event_date to end_date
      return data.filter((event) => {
        const eventStart = startOfDay(parseISO(event.event_date));
        const eventEnd = event.end_date 
          ? startOfDay(parseISO(event.end_date)) 
          : eventStart;

        return today >= eventStart && today <= eventEnd;
      }) as EventDayEvent[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
