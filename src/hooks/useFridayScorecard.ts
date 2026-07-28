import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, addDays, startOfDay, endOfDay, format, parseISO } from 'date-fns';

export interface FridayScorecardData {
  // This week's metrics
  newOpportunities: number;
  meetingsHeld: number;
  eventsAttended: number;
  anchorCandidatesIdentified: number;
  
  // Funnel progress
  funnelVolume: number;
  quarterlyTarget: number;
  funnelPercentage: number;
  
  // Next week priorities
  topPriorities: Priority[];
}

export interface Priority {
  id: string;
  type: 'event' | 'meeting';
  title: string;
  date: string;
  organization?: string;
  isAnchorRelated: boolean;
  priority: number;
}

export function useFridayScorecard(metroFilter?: string | null) {
  // Get the current week boundaries (Sunday to Saturday)
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
  
  // Next week boundaries
  const nextWeekStart = startOfDay(addDays(weekEnd, 1));
  const nextWeekEnd = endOfDay(addDays(nextWeekStart, 6));

  return useQuery({
    queryKey: ['friday-scorecard', format(weekStart, 'yyyy-MM-dd'), metroFilter],
    queryFn: async () => {
      const weekStartStr = weekStart.toISOString();
      const weekEndStr = weekEnd.toISOString();
      const nextWeekStartStr = nextWeekStart.toISOString();
      const nextWeekEndStr = nextWeekEnd.toISOString();

      // Calculate current quarter start for order volume
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const quarterStartStr = format(quarterStart, 'yyyy-MM-dd');

      // Fetch all data in parallel
      const [
        opportunitiesResult,
        activitiesResult,
        eventsResult,
        pipelineResult,
        metrosResult,
        nextWeekEventsResult,
        nextWeekMeetingsResult,
        googleMeetingsResult,
        ordersResult,
      ] = await Promise.all([
        // New opportunities this week
        supabase
          .from('opportunities')
          .select('id, organization, created_at, metro_id')
          .gte('created_at', weekStartStr)
          .lte('created_at', weekEndStr),
        
        // Activities (meetings) held this week
        supabase
          .from('activities')
          .select('id, activity_type, attended, activity_date_time, metro_id, contacts(name), opportunities(organization, id)')
          .gte('activity_date_time', weekStartStr)
          .lte('activity_date_time', weekEndStr),
        
        // Events attended this week
        supabase
          .from('events')
          .select('id, event_name, attended, event_date, metro_id')
          .gte('event_date', weekStartStr.split('T')[0])
          .lte('event_date', weekEndStr.split('T')[0]),
        
        // Anchor pipeline for candidates identification
        supabase
          .from('anchor_pipeline')
          .select('id, expected_anchor_yn, metro_id, stage, created_at, opportunity_id, opportunities(organization)'),
        
        // Metros for quarterly targets
        supabase
          .from('metros')
          .select('id, quarterly_target'),
        
        // Next week's events
        supabase
          .from('events')
          .select('id, event_name, event_date, metro_id, anchor_potential, priority, host_opportunity_id, host_organization')
          .gte('event_date', nextWeekStartStr.split('T')[0])
          .lte('event_date', nextWeekEndStr.split('T')[0])
          .order('event_date', { ascending: true }),
        
        // Next week's meetings
        supabase
          .from('activities')
          .select('id, activity_type, activity_date_time, metro_id, contacts(name), opportunities(organization, id), opportunity_id')
          .gte('activity_date_time', nextWeekStartStr)
          .lte('activity_date_time', nextWeekEndStr)
          .order('activity_date_time', { ascending: true }),
        
        // Google Calendar meetings attended this week
        supabase
          .from('google_calendar_events')
          .select('id, attended, start_time')
          .gte('start_time', weekStartStr)
          .lte('start_time', weekEndStr)
          .eq('attended', true),

        // Real orders this quarter for funnel volume
        supabase
          .from('opportunity_orders')
          .select('order_count, opportunity_id, opportunities!inner(metro_id)')
          .gte('order_date', quarterStartStr),
      ]);

      if (opportunitiesResult.error) throw opportunitiesResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (pipelineResult.error) throw pipelineResult.error;
      if (metrosResult.error) throw metrosResult.error;
      if (nextWeekEventsResult.error) throw nextWeekEventsResult.error;
      if (nextWeekMeetingsResult.error) throw nextWeekMeetingsResult.error;
      // Google meetings error is non-fatal, just log it
      if (googleMeetingsResult.error) {
        console.error('Error fetching Google meetings:', googleMeetingsResult.error);
      }
      // Orders error is non-fatal
      if (ordersResult.error) {
        console.error('Error fetching orders:', ordersResult.error);
      }

      // Apply metro filter if specified
      let opportunities = opportunitiesResult.data || [];
      let activities = activitiesResult.data || [];
      let events = eventsResult.data || [];
      let pipeline = pipelineResult.data || [];
      let metros = metrosResult.data || [];
      let nextWeekEvents = nextWeekEventsResult.data || [];
      let nextWeekMeetings = nextWeekMeetingsResult.data || [];
      const googleMeetingsAttended = googleMeetingsResult.data || [];
      let orders = ordersResult.data || [];

      if (metroFilter) {
        opportunities = opportunities.filter(o => o.metro_id === metroFilter);
        activities = activities.filter(a => a.metro_id === metroFilter);
        events = events.filter(e => e.metro_id === metroFilter);
        pipeline = pipeline.filter(p => p.metro_id === metroFilter);
        metros = metros.filter(m => m.id === metroFilter);
        nextWeekEvents = nextWeekEvents.filter(e => e.metro_id === metroFilter);
        nextWeekMeetings = nextWeekMeetings.filter(m => m.metro_id === metroFilter);
        orders = orders.filter(o => (o.opportunities as any)?.metro_id === metroFilter);
      }

      // Calculate metrics
      const newOpportunities = opportunities.length;
      
      // Meetings held = CRM activities with attended = true OR meetings that already occurred
      const crmMeetingsHeld = activities.filter(a => {
        const isPast = new Date(a.activity_date_time) < now;
        return a.attended === true || (isPast && a.attended !== false);
      }).length;
      
      // Add Google Calendar meetings marked as attended
      const meetingsHeld = crmMeetingsHeld + googleMeetingsAttended.length;
      
      // Events attended
      const eventsAttended = events.filter(e => e.attended === true).length;
      
      // Anchor candidates identified this week (expected_anchor_yn = true, created this week)
      const anchorCandidatesIdentified = pipeline.filter(p => {
        const createdThisWeek = p.created_at && 
          new Date(p.created_at) >= weekStart && 
          new Date(p.created_at) <= weekEnd;
        return p.expected_anchor_yn === true && createdThisWeek;
      }).length;
      
      // Funnel volume = sum of real order_count this quarter
      const funnelVolume = orders.reduce((sum, o) => {
        return sum + (o.order_count || 0);
      }, 0);
      
      // Quarterly target = sum of all metro targets, default 500 per metro
      const quarterlyTarget = metros.reduce((sum, m) => {
        return sum + ((m as any).quarterly_target || 500);
      }, 0) || 500;
      
      const funnelPercentage = quarterlyTarget > 0 ? Math.round((funnelVolume / quarterlyTarget) * 100) : 0;

      // Build next week priorities
      const priorities: Priority[] = [];
      
      // Score and add events (prioritize anchor potential and high priority)
      nextWeekEvents.forEach(event => {
        const isAnchorRelated = event.anchor_potential === 'High' || !!event.host_opportunity_id;
        const priorityScore = 
          (event.anchor_potential === 'High' ? 30 : event.anchor_potential === 'Medium' ? 20 : 10) +
          (event.priority === 'High' ? 20 : event.priority === 'Medium' ? 10 : 0);
        
        priorities.push({
          id: event.id,
          type: 'event',
          title: event.event_name,
          date: event.event_date,
          organization: event.host_organization || undefined,
          isAnchorRelated,
          priority: priorityScore,
        });
      });
      
      // Score and add meetings (prioritize anchor-related opportunities)
      nextWeekMeetings.forEach(meeting => {
        const hasOpportunity = !!meeting.opportunity_id;
        const isAnchorRelated = hasOpportunity; // meetings with opportunities are anchor-related
        const priorityScore = isAnchorRelated ? 40 : 15;
        
        const contactName = Array.isArray(meeting.contacts) 
          ? meeting.contacts[0]?.name 
          : (meeting.contacts as { name?: string })?.name;
        const orgName = Array.isArray(meeting.opportunities)
          ? meeting.opportunities[0]?.organization
          : (meeting.opportunities as { organization?: string })?.organization;
        
        priorities.push({
          id: meeting.id,
          type: 'meeting',
          title: `${meeting.activity_type}: ${contactName || orgName || 'Meeting'}`,
          date: meeting.activity_date_time,
          organization: orgName,
          isAnchorRelated,
          priority: priorityScore,
        });
      });
      
      // Sort by priority (highest first) and take top 3
      const topPriorities = priorities
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);

      return {
        newOpportunities,
        meetingsHeld,
        eventsAttended,
        anchorCandidatesIdentified,
        funnelVolume,
        quarterlyTarget,
        funnelPercentage,
        topPriorities,
      } as FridayScorecardData;
    },
  });
}
