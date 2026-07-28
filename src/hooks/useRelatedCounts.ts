import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RelatedCounts {
  contacts: number;
  grants: number;
  events: number;
  activities: number;
  pipeline: number;
}

export function useOpportunityRelatedCounts(opportunityId: string | null) {
  return useQuery({
    queryKey: ['opportunity-related-counts', opportunityId],
    queryFn: async (): Promise<RelatedCounts> => {
      if (!opportunityId) {
        return { contacts: 0, grants: 0, events: 0, activities: 0, pipeline: 0 };
      }

      const [contacts, grants, events, activities, pipeline] = await Promise.all([
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('opportunity_id', opportunityId),
        supabase
          .from('grants')
          .select('id', { count: 'exact', head: true })
          .eq('opportunity_id', opportunityId),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('host_opportunity_id', opportunityId),
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('opportunity_id', opportunityId),
        supabase
          .from('anchor_pipeline')
          .select('id', { count: 'exact', head: true })
          .eq('opportunity_id', opportunityId),
      ]);

      return {
        contacts: contacts.count || 0,
        grants: grants.count || 0,
        events: events.count || 0,
        activities: activities.count || 0,
        pipeline: pipeline.count || 0,
      };
    },
    enabled: !!opportunityId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

export function useContactRelatedCounts(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-related-counts', contactId],
    queryFn: async () => {
      if (!contactId) {
        return { tasks: 0, emails: 0, meetings: 0 };
      }

      const [tasks, emails, meetings] = await Promise.all([
        supabase
          .from('contact_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contactId),
        supabase
          .from('email_communications')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contactId),
        supabase
          .from('google_calendar_events')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contactId),
      ]);

      return {
        tasks: tasks.count || 0,
        emails: emails.count || 0,
        meetings: meetings.count || 0,
      };
    },
    enabled: !!contactId,
    staleTime: 30000,
  });
}
