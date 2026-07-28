import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

export interface EventAttendee {
  id: string;
  email: string;
  displayName?: string;
  responseStatus?: string;
  isOrganizer?: boolean;
  existsAsContact?: boolean;
  contactId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  type: 'event' | 'meeting' | 'activity' | 'external';
  color: string;
  metadata: {
    eventType?: string;
    activityType?: string;
    contactName?: string;
    organization?: string;
    metro?: string;
    googleSynced?: boolean;
    url?: string;
    isExternal?: boolean;
    description?: string;
    location?: string;
    attendees?: EventAttendee[];
  };
}

export function useCalendarData(currentDate: Date) {
  const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['calendar-data', startDate, endDate],
    queryFn: async () => {
      // Fetch events for the month
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          event_type,
          google_calendar_event_id,
          url,
          metros (metro)
        `)
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .eq('is_local_pulse', false);
      
      if (eventsError) throw eventsError;
      
      // Fetch activities (including meetings) for the month
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select(`
          id,
          activity_type,
          activity_date_time,
          notes,
          google_calendar_event_id,
          contacts!contact_id (name),
          opportunities (organization),
          metros (metro)
        `)
        .gte('activity_date_time', `${startDate}T00:00:00`)
        .lte('activity_date_time', `${endDate}T23:59:59`);
      
      if (activitiesError) throw activitiesError;
      
      // Fetch external Google Calendar events with attendees
      const { data: externalEvents, error: externalError } = await supabase
        .from('google_calendar_events')
        .select(`
          id,
          google_event_id,
          title,
          description,
          start_time,
          end_time,
          location,
          is_all_day,
          attended,
          contact_id,
          google_calendar_attendees (
            id,
            email,
            display_name,
            response_status,
            is_organizer
          )
        `)
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .eq('hidden', false);
      
      if (externalError) {
        console.error('Error fetching external events:', externalError);
      }
      
      // Fetch all contacts for email matching
      const { data: allContacts } = await supabase
        .from('contacts')
        .select('id, email, name');
      
      // Create email lookup map for O(1) matching
      const contactsByEmail = new Map(
        (allContacts || [])
          .filter(c => c.email)
          .map(c => [c.email!.toLowerCase(), c])
      );
      
      // Transform events to calendar format
      // Use parseISO for date-only strings to prevent timezone shift
      const calendarEvents: CalendarEvent[] = (events || []).map(event => ({
        id: event.id,
        title: event.event_name,
        date: parseISO(event.event_date),
        type: 'event' as const,
        color: getEventColor(event.event_type),
        metadata: {
          eventType: event.event_type || undefined,
          metro: event.metros?.metro,
          googleSynced: !!event.google_calendar_event_id,
          url: event.url || undefined
        }
      }));
      
      // Filter out backward-looking logged activities (Call, Email, Intro, Other)
      // Only keep forward-looking activity types on the calendar
      const forwardActivityTypes = ['Meeting', 'Site Visit', 'Event'];
      const calendarActivities: CalendarEvent[] = (activities || [])
        .filter(activity => forwardActivityTypes.includes(activity.activity_type))
        // Hide activities that are linked to a Google Calendar event — the
        // external Google event already renders (purple dot) and we don't want
        // a duplicate green activity dot for the same meeting.
        .filter(activity => !activity.google_calendar_event_id)
        .map(activity => ({
        id: activity.id,
        title: activity.activity_type === 'Meeting' 
          ? `Meeting: ${activity.contacts?.name || activity.opportunities?.organization || 'Scheduled'}`
          : `${activity.activity_type}${activity.notes ? `: ${activity.notes.substring(0, 30)}...` : ''}`,
        date: new Date(activity.activity_date_time),
        type: activity.activity_type === 'Meeting' ? 'meeting' as const : 'activity' as const,
        color: getActivityColor(activity.activity_type),
        metadata: {
          activityType: activity.activity_type,
          contactName: activity.contacts?.name,
          organization: activity.opportunities?.organization,
          metro: activity.metros?.metro,
          googleSynced: !!activity.google_calendar_event_id
        }
      }));
      
      // Transform external Google Calendar events
      const calendarExternalEvents: CalendarEvent[] = (externalEvents || []).map(ext => {
        // Cross-reference attendees with contacts
        const attendees: EventAttendee[] = (ext.google_calendar_attendees || []).map(att => {
          const existingContact = contactsByEmail.get(att.email.toLowerCase());
          return {
            id: att.id,
            email: att.email,
            displayName: att.display_name || undefined,
            responseStatus: att.response_status || undefined,
            isOrganizer: att.is_organizer,
            existsAsContact: !!existingContact,
            contactId: existingContact?.id
          };
        });
        
        return {
          id: ext.id,
          title: ext.title,
          date: new Date(ext.start_time),
          endDate: ext.end_time ? new Date(ext.end_time) : undefined,
          type: 'external' as const,
          color: 'hsl(280 60% 55%)', // Purple for external events
          metadata: {
            isExternal: true,
            googleSynced: true,
            description: ext.description || undefined,
            location: ext.location || undefined,
            attendees
          }
        };
      });
      
      return [...calendarEvents, ...calendarActivities, ...calendarExternalEvents]
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    }
  });
}

function getEventColor(eventType: string | null): string {
  const colors: Record<string, string> = {
    'Distribution': 'hsl(var(--primary))',
    'Sign-up': 'hsl(var(--success))',
    'Tabling': 'hsl(var(--warning))',
    'Workshop': 'hsl(var(--info))',
    'Partner Event': 'hsl(var(--accent))'
  };
  return colors[eventType || ''] || 'hsl(var(--muted-foreground))';
}

function getActivityColor(activityType: string): string {
  const colors: Record<string, string> = {
    'Meeting': 'hsl(var(--chart-2))',
    'Call': 'hsl(var(--success))',
    'Email': 'hsl(var(--primary))',
    'Site Visit': 'hsl(var(--accent))',
    'Event': 'hsl(var(--warning))',
    'Intro': 'hsl(var(--chart-5))',
    'Other': 'hsl(var(--muted-foreground))'
  };
  return colors[activityType] || 'hsl(var(--muted-foreground))';
}