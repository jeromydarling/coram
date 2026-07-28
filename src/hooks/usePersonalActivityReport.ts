import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  subWeeks,
  subMonths,
  format,
  eachWeekOfInterval,
  eachMonthOfInterval,
  parseISO,
} from 'date-fns';

export type TimePeriod = 'weekly' | 'monthly' | 'yearly';

export interface ActivityCounts {
  meetings: number;
  meetingsAttended: number;
  events: number;
  eventsAttended: number;
  tasksCompleted: number;
  total: number;
}

export interface PeriodData {
  label: string;
  startDate: string;
  endDate: string;
  counts: ActivityCounts;
}

export interface TrendData {
  periods: PeriodData[];
  currentPeriod: ActivityCounts;
  previousPeriod: ActivityCounts;
  percentChange: {
    meetings: number;
    meetingsAttended: number;
    events: number;
    eventsAttended: number;
    tasksCompleted: number;
    total: number;
  };
  ytdTotals: ActivityCounts;
}

export function usePersonalActivityReport(timePeriod: TimePeriod) {
  const { user } = useAuth();
  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  return useQuery({
    queryKey: ['personal-activity-report', user?.id, timePeriod],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get user's assigned metros
      const { data: metroAssignments } = await supabase
        .from('user_metro_assignments')
        .select('metro_id')
        .eq('user_id', user.id);

      // Get user's assigned regions (for indirect metro access)
      const { data: regionAssignments } = await supabase
        .from('user_region_assignments')
        .select('region_id')
        .eq('user_id', user.id);

      // Get metros in assigned regions
      let regionMetroIds: string[] = [];
      if (regionAssignments && regionAssignments.length > 0) {
        const regionIds = regionAssignments.map(r => r.region_id);
        const { data: regionMetros } = await supabase
          .from('metros')
          .select('id')
          .in('region_id', regionIds);
        regionMetroIds = regionMetros?.map(m => m.id) || [];
      }

      const directMetroIds = metroAssignments?.map(m => m.metro_id) || [];
      const allMetroIds = [...new Set([...directMetroIds, ...regionMetroIds])];

      // Define periods based on time period type
      let periods: { label: string; start: Date; end: Date }[] = [];
      
      if (timePeriod === 'weekly') {
        // Last 12 weeks
        const weeks = eachWeekOfInterval({ start: subWeeks(now, 11), end: now });
        periods = weeks.map(weekStart => ({
          label: format(weekStart, 'MMM d'),
          start: startOfWeek(weekStart),
          end: endOfWeek(weekStart),
        }));
      } else if (timePeriod === 'monthly') {
        // Last 12 months
        const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
        periods = months.map(monthStart => ({
          label: format(monthStart, 'MMM yyyy'),
          start: startOfMonth(monthStart),
          end: endOfMonth(monthStart),
        }));
      } else {
        // Yearly - show months of current year
        const months = eachMonthOfInterval({ start: yearStart, end: now });
        periods = months.map(monthStart => ({
          label: format(monthStart, 'MMM'),
          start: startOfMonth(monthStart),
          end: endOfMonth(monthStart),
        }));
      }

      // Fetch all activities (meetings) for the year
      const { data: activities } = await supabase
        .from('activities')
        .select('id, activity_type, activity_date_time, metro_id, attended')
        .gte('activity_date_time', yearStart.toISOString())
        .lte('activity_date_time', yearEnd.toISOString());

      // Fetch all events for the year
      const { data: events } = await supabase
        .from('events')
        .select('id, event_date, metro_id, attended')
        .gte('event_date', format(yearStart, 'yyyy-MM-dd'))
        .lte('event_date', format(yearEnd, 'yyyy-MM-dd'));

      // Fetch completed tasks for the year (created by user or in user's metros)
      const { data: tasks } = await supabase
        .from('contact_tasks')
        .select('id, completed_at, created_by')
        .eq('is_completed', true)
        .gte('completed_at', yearStart.toISOString())
        .lte('completed_at', yearEnd.toISOString());

      // Filter to user's metros (for admin/leadership, show all)
      // Also include activities with no metro assigned (they belong to anyone)
      const filterByMetro = (metroId: string | null) => {
        if (allMetroIds.length === 0) return true; // Admin/leadership see all
        if (!metroId) return true; // Include activities without metro assignment
        return allMetroIds.includes(metroId);
      };

      const userActivities = (activities || []).filter(a => filterByMetro(a.metro_id));
      const userEvents = (events || []).filter(e => filterByMetro(e.metro_id));
      const userTasks = (tasks || []).filter(t => t.created_by === user.id);

      // Count activities by period
      const periodData: PeriodData[] = periods.map(period => {
        const meetingsInPeriod = userActivities.filter(a => {
          const date = parseISO(a.activity_date_time);
          return date >= period.start && date <= period.end && a.activity_type === 'Meeting';
        });
        
        const meetingsAttendedInPeriod = meetingsInPeriod.filter(a => a.attended === true).length;

        const eventsInPeriod = userEvents.filter(e => {
          const date = parseISO(e.event_date);
          return date >= period.start && date <= period.end;
        });
        
        const eventsAttendedInPeriod = eventsInPeriod.filter(e => e.attended === true).length;

        const tasksInPeriod = userTasks.filter(t => {
          if (!t.completed_at) return false;
          const date = parseISO(t.completed_at);
          return date >= period.start && date <= period.end;
        }).length;

        return {
          label: period.label,
          startDate: format(period.start, 'yyyy-MM-dd'),
          endDate: format(period.end, 'yyyy-MM-dd'),
          counts: {
            meetings: meetingsInPeriod.length,
            meetingsAttended: meetingsAttendedInPeriod,
            events: eventsInPeriod.length,
            eventsAttended: eventsAttendedInPeriod,
            tasksCompleted: tasksInPeriod,
            total: meetingsInPeriod.length + eventsInPeriod.length + tasksInPeriod,
          },
        };
      });

      // Calculate current and previous period for comparison
      const currentPeriod = periodData[periodData.length - 1]?.counts || { meetings: 0, meetingsAttended: 0, events: 0, eventsAttended: 0, tasksCompleted: 0, total: 0 };
      const previousPeriod = periodData[periodData.length - 2]?.counts || { meetings: 0, meetingsAttended: 0, events: 0, eventsAttended: 0, tasksCompleted: 0, total: 0 };

      // Calculate percent change
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      // Calculate YTD totals
      const allMeetings = userActivities.filter(a => a.activity_type === 'Meeting');
      const ytdTotals: ActivityCounts = {
        meetings: allMeetings.length,
        meetingsAttended: allMeetings.filter(a => a.attended === true).length,
        events: userEvents.length,
        eventsAttended: userEvents.filter(e => e.attended === true).length,
        tasksCompleted: userTasks.length,
        total: allMeetings.length + userEvents.length + userTasks.length,
      };

      return {
        periods: periodData,
        currentPeriod,
        previousPeriod,
        percentChange: {
          meetings: calcChange(currentPeriod.meetings, previousPeriod.meetings),
          meetingsAttended: calcChange(currentPeriod.meetingsAttended, previousPeriod.meetingsAttended),
          events: calcChange(currentPeriod.events, previousPeriod.events),
          eventsAttended: calcChange(currentPeriod.eventsAttended, previousPeriod.eventsAttended),
          tasksCompleted: calcChange(currentPeriod.tasksCompleted, previousPeriod.tasksCompleted),
          total: calcChange(currentPeriod.total, previousPeriod.total),
        },
        ytdTotals,
      } as TrendData;
    },
    enabled: !!user?.id,
  });
}
