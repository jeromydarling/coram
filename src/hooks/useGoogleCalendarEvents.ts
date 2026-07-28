import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface UpdateGoogleCalendarEventParams {
  id: string;
  attended?: boolean;
  contact_id?: string | null;
}

export function useUpdateGoogleCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, attended, contact_id }: UpdateGoogleCalendarEventParams) => {
      const updateData: Record<string, unknown> = {};
      
      if (attended !== undefined) {
        updateData.attended = attended;
      }
      
      if (contact_id !== undefined) {
        updateData.contact_id = contact_id;
      }

      const { data, error } = await supabase
        .from('google_calendar_events')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['contact-meeting-history'] });
      queryClient.invalidateQueries({ queryKey: ['friday-scorecard'] });
    },
    onError: (error) => {
      console.error('Error updating Google Calendar event:', error);
      toast.error('Failed to update event');
    }
  });
}

export function useGoogleCalendarEventsForContact(contactId: string | undefined) {
  return useQuery({
    queryKey: ['google-calendar-events-contact', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('google_calendar_events')
        .select('*')
        .eq('contact_id', contactId)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId
  });
}

export function useGoogleCalendarEventById(eventId: string | undefined) {
  return useQuery({
    queryKey: ['google-calendar-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const { data, error } = await supabase
        .from('google_calendar_events')
        .select('*, contacts(id, name, email)')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!eventId
  });
}
