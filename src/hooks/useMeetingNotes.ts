import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MeetingNote {
  id: string;
  user_id: string;
  google_calendar_event_id: string | null;
  source: string;
  source_meeting_id: string;
  meeting_title: string;
  meeting_start_time: string | null;
  meet_link: string | null;
  summary: string | null;
  action_items: string[];
  matched_action_items: string[];
  skipped_action_items: string[];
  recording_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useMeetingNotesForContact(contactId: string | undefined) {
  return useQuery({
    queryKey: ['meeting-notes-contact', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      // Get meeting notes linked to this contact via junction table
      const { data, error } = await supabase
        .from('meeting_note_contacts')
        .select(`
          is_primary,
          meeting_notes (
            id,
            user_id,
            google_calendar_event_id,
            source,
            source_meeting_id,
            meeting_title,
            meeting_start_time,
            meet_link,
            summary,
            action_items,
            matched_action_items,
            skipped_action_items,
            recording_url,
            created_at,
            updated_at
          )
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flatten the nested structure
      return (data || [])
        .map(row => row.meeting_notes as unknown as MeetingNote)
        .filter(note => note !== null);
    },
    enabled: !!contactId
  });
}

export function useMeetingNoteByCalendarEvent(calendarEventId: string | undefined) {
  return useQuery({
    queryKey: ['meeting-note-calendar', calendarEventId],
    queryFn: async () => {
      if (!calendarEventId) return null;

      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('google_calendar_event_id', calendarEventId)
        .maybeSingle();

      if (error) throw error;
      return data as MeetingNote | null;
    },
    enabled: !!calendarEventId
  });
}
