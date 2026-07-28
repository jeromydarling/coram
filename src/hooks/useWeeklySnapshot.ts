import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, addDays, format, parseISO, isWithinInterval, isSameDay } from 'date-fns';

export interface UpcomingEvent {
  id: string;
  event_name: string;
  event_date: string;
  end_date?: string | null;
  event_type?: string | null;
  city?: string | null;
  metro?: string | null;
  status?: string | null;
}

export interface UpcomingMeeting {
  id: string;
  activity_type: string;
  activity_date_time: string;
  contact_name?: string | null;
  contact_email?: string | null;
  organization?: string | null;
  notes?: string | null;
}

export interface UpcomingTask {
  id: string;
  title: string;
  description?: string | null;
  due_date: string;
  contact_id: string;
  contact_name?: string | null;
  organization?: string | null;
  is_completed: boolean;
}

export interface UpcomingGoogleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
}

export interface DaySnapshot {
  date: string;
  dayLabel: string;
  events: UpcomingEvent[];
  meetings: UpcomingMeeting[];
  tasks: UpcomingTask[];
  googleEvents: UpcomingGoogleEvent[];
}

export function useWeeklySnapshot(metroFilter?: string | null) {
  const today = startOfDay(new Date());
  const weekEnd = endOfDay(addDays(today, 6));

  return useQuery({
    queryKey: ['weekly-snapshot', format(today, 'yyyy-MM-dd'), metroFilter],
    queryFn: async () => {
      const startStr = today.toISOString();
      const endStr = weekEnd.toISOString();

      // Fetch events for the next 7 days (including multi-day events that started earlier)
      // We need events where: event_date <= weekEnd AND (end_date >= today OR end_date is null AND event_date >= today)
      let eventsQuery = supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          end_date,
          event_type,
          city,
          status,
          metro_id,
          metros (metro)
        `)
        .lte('event_date', endStr.split('T')[0])
        .or(`end_date.gte.${startStr.split('T')[0]},and(end_date.is.null,event_date.gte.${startStr.split('T')[0]})`)
        .eq('is_local_pulse', false)
        .order('event_date', { ascending: true });

      if (metroFilter) {
        eventsQuery = eventsQuery.eq('metro_id', metroFilter);
      }

      const { data: events, error: eventsError } = await eventsQuery;

      if (eventsError) throw eventsError;

      // Fetch meetings (activities) for the next 7 days
      // Only forward-looking activity types — logged calls/emails belong on /activities
      const forwardActivityTypes = ['Meeting', 'Site Visit', 'Event'] as const;
      let activitiesQuery = supabase
        .from('activities')
        .select(`
          id,
          activity_type,
          activity_date_time,
          notes,
          metro_id,
          contacts!contact_id (name, email),
          opportunities (organization)
        `)
        .in('activity_type', forwardActivityTypes)
        .gte('activity_date_time', startStr)
        .lte('activity_date_time', endStr)
        .order('activity_date_time', { ascending: true });

      if (metroFilter) {
        activitiesQuery = activitiesQuery.eq('metro_id', metroFilter);
      }

      const { data: activities, error: activitiesError } = await activitiesQuery;

      if (activitiesError) throw activitiesError;

      // Fetch incomplete tasks with due dates in the next 7 days
      const { data: tasks, error: tasksError } = await supabase
        .from('contact_tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          contact_id,
          is_completed,
          contacts (
            name,
            opportunity_id,
            opportunities!contacts_opportunity_id_fkey (
              organization
            )
          )
        `)
        .eq('is_completed', false)
        .gte('due_date', startStr.split('T')[0])
        .lte('due_date', endStr.split('T')[0])
        .order('due_date', { ascending: true });

      if (tasksError) throw tasksError;

      // Fetch external Google Calendar events for the next 7 days
      const { data: googleEvents, error: googleEventsError } = await supabase
        .from('google_calendar_events')
        .select(`
          id,
          title,
          start_time,
          end_time,
          location,
          description
        `)
        .gte('start_time', startStr)
        .lte('start_time', endStr)
        .eq('hidden', false)
        .order('start_time', { ascending: true });

      if (googleEventsError) {
        console.error('Error fetching Google Calendar events:', googleEventsError);
      }

      // Organize by day
      const days: DaySnapshot[] = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEEE, MMM d');

        // Filter events that span this day (either single-day match or multi-day range)
        const dayEvents: UpcomingEvent[] = (events || [])
          .filter(e => {
            const eventStart = startOfDay(parseISO(e.event_date));
            const eventEnd = e.end_date ? startOfDay(parseISO(e.end_date)) : eventStart;
            // Check if this day falls within the event's date range
            return isWithinInterval(date, { start: eventStart, end: eventEnd });
          })
          .map(e => ({
            id: e.id,
            event_name: e.event_name,
            event_date: e.event_date,
            end_date: e.end_date,
            event_type: e.event_type,
            city: e.city,
            metro: (e.metros as { metro: string } | null)?.metro || null,
            status: e.status,
          }));

        const dayMeetings: UpcomingMeeting[] = (activities || [])
          .filter(a => a.activity_date_time.startsWith(dateStr))
          .map(a => ({
            id: a.id,
            activity_type: a.activity_type,
            activity_date_time: a.activity_date_time,
            contact_name: (a.contacts as { name: string; email?: string } | null)?.name || null,
            contact_email: (a.contacts as { name: string; email?: string } | null)?.email || null,
            organization: (a.opportunities as { organization: string } | null)?.organization || null,
            notes: a.notes,
          }));

        const dayTasks: UpcomingTask[] = (tasks || [])
          .filter(t => t.due_date?.startsWith(dateStr))
          .map(t => {
            const contact = t.contacts as { name: string; opportunity_id?: string | null; opportunities?: { organization: string } | null } | null;
            return {
              id: t.id,
              title: t.title,
              description: t.description,
              due_date: t.due_date!,
              contact_id: t.contact_id,
              contact_name: contact?.name || null,
              organization: contact?.opportunities?.organization || null,
              is_completed: t.is_completed,
            };
          });

        // Filter Google events by comparing local date to avoid timezone issues
        const dayGoogleEvents: UpcomingGoogleEvent[] = (googleEvents || [])
          .filter(g => {
            // Parse the timestamp and compare using isSameDay to handle timezone correctly
            const eventDate = new Date(g.start_time);
            return isSameDay(eventDate, date);
          })
          .map(g => ({
            id: g.id,
            title: g.title,
            start_time: g.start_time,
            end_time: g.end_time,
            location: g.location,
            description: g.description,
          }));

        days.push({
          date: dateStr,
          dayLabel,
          events: dayEvents,
          meetings: dayMeetings,
          tasks: dayTasks,
          googleEvents: dayGoogleEvents,
        });
      }

      // Calculate totals
      const totalEvents = days.reduce((sum, d) => sum + d.events.length, 0);
      const totalMeetings = days.reduce((sum, d) => sum + d.meetings.length, 0);
      const totalTasks = days.reduce((sum, d) => sum + d.tasks.length, 0);
      const totalGoogleEvents = days.reduce((sum, d) => sum + d.googleEvents.length, 0);

      return {
        days,
        totals: {
          events: totalEvents,
          meetings: totalMeetings,
          tasks: totalTasks,
          googleEvents: totalGoogleEvents,
        },
      };
    },
  });
}
