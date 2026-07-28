/**
 * useUnifiedActivities — Unified feed of CRM activities + Google Calendar events.
 *
 * WHAT: Merges CRM activities (including Visits, Projects, Notes) with Google Calendar.
 * WHERE: Activities page.
 * WHY: Single timeline for all relational engagement — no scattered modules.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UnifiedActivity {
  id: string;
  source: 'crm' | 'google';
  activity_type: string;
  title: string;
  date_time: string;
  notes: string | null;
  outcome: string | null;
  next_action: string | null;
  next_action_due: string | null;
  attended: boolean | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  opportunity_id: string | null;
  organization: string | null;
  metro_id: string | null;
  metro: string | null;
  location: string | null;
  parent_activity_id: string | null;
  project_status: string | null;
  subject_contact_id: string | null;
}

export function useUnifiedActivities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unified-activities', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch CRM activities (including Projects, Visits, Notes — all types)
      const { data: crmActivities, error: crmError } = await supabase
        .from('activities')
        .select(`
          id,
          activity_type,
          activity_date_time,
          title,
          notes,
          outcome,
          next_action,
          next_action_due,
          attended,
          contact_id,
          opportunity_id,
          metro_id,
          parent_activity_id,
          project_status,
          subject_contact_id,
          location,
          contacts!contact_id (name, email),
          opportunities (organization, metros (metro)),
          metros (metro)
        `)
        .order('activity_date_time', { ascending: false });

      if (crmError) throw crmError;

      // Fetch Google Calendar events for current user
      const { data: googleEvents, error: googleError } = await supabase
        .from('google_calendar_events')
        .select(`
          id,
          title,
          start_time,
          description,
          location,
          attended,
          contact_id,
          contacts!contact_id (name, email)
        `)
        .eq('user_id', user.id)
        .eq('hidden', false)
        .order('start_time', { ascending: false });

      if (googleError) throw googleError;

      // Transform CRM activities
      const transformedCrm: UnifiedActivity[] = (crmActivities || []).map(activity => ({
        id: activity.id,
        source: 'crm' as const,
        activity_type: activity.activity_type,
        title: activity.title || activity.activity_type,
        date_time: activity.activity_date_time,
        notes: activity.notes,
        outcome: activity.outcome,
        next_action: activity.next_action,
        next_action_due: activity.next_action_due,
        attended: activity.attended,
        contact_id: activity.contact_id,
        contact_name: activity.contacts?.name || null,
        contact_email: activity.contacts?.email || null,
        opportunity_id: activity.opportunity_id,
        organization: activity.opportunities?.organization || null,
        metro_id: activity.metro_id,
        metro: activity.opportunities?.metros?.metro || activity.metros?.metro || null,
        location: activity.location || null,
        parent_activity_id: activity.parent_activity_id,
        project_status: activity.project_status,
        subject_contact_id: activity.subject_contact_id,
      }));

      // Transform Google Calendar events
      const transformedGoogle: UnifiedActivity[] = (googleEvents || []).map(event => ({
        id: event.id,
        source: 'google' as const,
        activity_type: 'Meeting',
        title: event.title,
        date_time: event.start_time,
        notes: event.description,
        outcome: null,
        next_action: null,
        next_action_due: null,
        attended: event.attended,
        contact_id: event.contact_id,
        contact_name: event.contacts?.name || null,
        contact_email: event.contacts?.email || null,
        opportunity_id: null,
        organization: null,
        metro_id: null,
        metro: null,
        location: event.location,
        parent_activity_id: null,
        project_status: null,
        subject_contact_id: null,
      }));

      const now = new Date();

      // Merge, filter, and sort
      // Projects always show (they don't require attendance check)
      // Visit Notes / Project Notes are child items — exclude from main list
      // Calls, Emails, Intros, Other don't require attendance
      // Meeting-type activities (Meeting, Event, Site Visit) must be attended
      const unified = [...transformedCrm, ...transformedGoogle]
        .filter(activity => {
          // Exclude child notes from the main feed — they appear on detail pages
          if (activity.parent_activity_id) return false;

          const isPast = new Date(activity.date_time) < now;

          // Projects always show regardless of past/future
          if (activity.activity_type === 'Project') return true;
          // Visits show if in past
          if (activity.activity_type === 'Visit') return isPast;

          if (!isPast) return false;

          // These activity types don't need attendance tracking
          const noAttendanceRequired = ['Call', 'Email', 'Intro', 'Other'];
          if (noAttendanceRequired.includes(activity.activity_type)) return true;

          // Meeting-type activities require attended=true
          return activity.attended === true;
        })
        .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());

      return unified;
    },
    enabled: !!user?.id
  });
}
