import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MeetingHistoryItem {
  id: string;
  title: string;
  date: string;
  attended: boolean | null;
  source: 'crm' | 'google';
  activityType?: string;
  notes?: string | null;
}

export function useContactMeetingHistory(contactId: string | undefined, contactEmail?: string | null) {
  return useQuery({
    queryKey: ['contact-meeting-history', contactId, contactEmail],
    queryFn: async () => {
      if (!contactId) return [];

      const meetings: MeetingHistoryItem[] = [];

      // Fetch CRM activities (meetings) for this contact
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('id, activity_type, activity_date_time, attended, notes, google_calendar_event_id')
        .eq('contact_id', contactId)
        .order('activity_date_time', { ascending: false })
        .limit(20);

      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError);
      } else if (activities) {
        activities.forEach(activity => {
          meetings.push({
            id: activity.id,
            title: activity.activity_type === 'Meeting' 
              ? `Meeting${activity.notes ? `: ${activity.notes.substring(0, 50)}` : ''}`
              : `${activity.activity_type}${activity.notes ? `: ${activity.notes.substring(0, 50)}` : ''}`,
            date: activity.activity_date_time,
            attended: activity.attended,
            source: 'crm',
            activityType: activity.activity_type,
            notes: activity.notes
          });
        });
      }

      // Collect Google-native event IDs already represented by CRM activities
      const linkedGoogleEventIds = new Set(
        (activities || [])
          .map(a => a.google_calendar_event_id)
          .filter(Boolean)
      );

      // Fetch Google Calendar events linked to this contact (include google_event_id for dedup)
      const { data: googleEvents, error: googleError } = await supabase
        .from('google_calendar_events')
        .select('id, title, start_time, attended, google_event_id')
        .eq('contact_id', contactId)
        .order('start_time', { ascending: false })
        .limit(20);

      if (googleError) {
        console.error('Error fetching Google events:', googleError);
      } else if (googleEvents) {
        googleEvents.forEach(event => {
          // Skip if a CRM activity already covers this calendar event
          // CRM stores google_event_id string, calendar table uses UUID — match both
          if (event.google_event_id && linkedGoogleEventIds.has(event.google_event_id)) return;
          if (linkedGoogleEventIds.has(event.id)) return;
          meetings.push({
            id: event.id,
            title: event.title,
            date: event.start_time,
            attended: event.attended,
            source: 'google'
          });
        });
      }

      // Sort by date descending and limit to 20 total
      return meetings
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);
    },
    enabled: !!contactId
  });
}
