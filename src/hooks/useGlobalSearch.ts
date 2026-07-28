import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  type: 'opportunity' | 'contact' | 'event' | 'pipeline' | 'grant' | 'document' | 'activity';
  title: string;
  subtitle: string;
  route: string;
}

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['global-search', query],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!query || query.length < 2) return [];

      const searchTerm = `%${query}%`;
      const results: SearchResult[] = [];

      // Search Opportunities — fetch slug for deep-link
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id, organization, stage, slug, metros(metro)')
        .or(`organization.ilike.${searchTerm},primary_contact_name.ilike.${searchTerm}`)
        .limit(5);

      if (opportunities) {
        for (const opp of opportunities) {
          results.push({
            id: opp.id,
            type: 'opportunity',
            title: opp.organization,
            subtitle: `${opp.stage || 'No stage'} • ${(opp.metros as any)?.metro || 'No metro'}`,
            route: opp.slug ? `/opportunities/${opp.slug}` : '/opportunities',
          });
        }
      }

      // Search Contacts — fetch slug for deep-link
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, title, slug, opportunities!contacts_opportunity_id_fkey(organization)')
        .or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (contacts) {
        for (const contact of contacts) {
          results.push({
            id: contact.id,
            type: 'contact',
            title: contact.name,
            subtitle: contact.title || (contact.opportunities as any)?.organization || 'Contact',
            route: contact.slug ? `/people/${contact.slug}` : '/contacts',
          });
        }
      }

      // Search Events — fetch slug for deep-link
      const { data: events } = await supabase
        .from('events')
        .select('id, event_name, event_type, city, slug')
        .or(`event_name.ilike.${searchTerm},city.ilike.${searchTerm}`)
        .limit(5);

      if (events) {
        for (const event of events) {
          results.push({
            id: event.id,
            type: 'event',
            title: event.event_name,
            subtitle: `${event.event_type || 'Event'} • ${event.city || 'No location'}`,
            route: event.slug ? `/events/${event.slug}` : '/events',
          });
        }
      }

      // Search Pipeline
      const { data: pipelines } = await supabase
        .from('anchor_pipeline')
        .select('id, stage, opportunities(organization, slug), metros(metro)')
        .limit(5);

      if (pipelines) {
        const filteredPipelines = pipelines.filter(p =>
          (p.opportunities as any)?.organization?.toLowerCase().includes(query.toLowerCase()) ||
          (p.metros as any)?.metro?.toLowerCase().includes(query.toLowerCase())
        );

        for (const pl of filteredPipelines.slice(0, 5)) {
          results.push({
            id: pl.id,
            type: 'pipeline',
            title: (pl.opportunities as any)?.organization || 'Pipeline Item',
            subtitle: `${pl.stage || 'Unknown stage'} • ${(pl.metros as any)?.metro || 'No metro'}`,
            route: '/pipeline',
          });
        }
      }

      // Search Grants — deep-link by id
      const { data: grants } = await supabase
        .from('grants')
        .select('id, grant_name, funder_name, stage, metros(metro)')
        .or(`grant_name.ilike.${searchTerm},funder_name.ilike.${searchTerm}`)
        .limit(5);

      if (grants) {
        for (const grant of grants) {
          results.push({
            id: grant.id,
            type: 'grant',
            title: grant.grant_name,
            subtitle: `${grant.funder_name} • ${grant.stage || 'No stage'}`,
            route: `/grants/${grant.id}`,
          });
        }
      }

      // Search Documents
      const { data: documents } = await supabase
        .from('documents')
        .select('id, name, category, file_type, description')
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm}`)
        .limit(5);

      if (documents) {
        for (const doc of documents) {
          const fileType = doc.file_type?.toUpperCase().replace('APPLICATION/', '') || 'File';
          results.push({
            id: doc.id,
            type: 'document',
            title: doc.name,
            subtitle: `${doc.category || 'Document'} • ${fileType}`,
            route: '/settings?tab=documents',
          });
        }
      }

      // Search Activities (CRM) — link to the associated person or opportunity
      const { data: activities } = await supabase
        .from('activities')
        .select('id, activity_type, activity_date_time, notes, contacts(name, slug), opportunities(organization, slug)')
        .or(`notes.ilike.${searchTerm}`)
        .limit(5);

      if (activities) {
        for (const act of activities) {
          const contactName = (act.contacts as any)?.name;
          const orgName = (act.opportunities as any)?.organization;
          const contactSlug = (act.contacts as any)?.slug;
          const oppSlug = (act.opportunities as any)?.slug;

          // Link to contact if available, else opportunity, else activities list
          let route = '/contacts';
          if (contactSlug) route = `/people/${contactSlug}`;
          else if (oppSlug) route = `/opportunities/${oppSlug}`;

          results.push({
            id: act.id,
            type: 'activity',
            title: `${act.activity_type}${contactName ? ` — ${contactName}` : ''}`,
            subtitle: `${orgName || 'No org'} • ${new Date(act.activity_date_time).toLocaleDateString()}`,
            route,
          });
        }
      }

      // Search Google Calendar events — match by title
      const { data: gcalEvents } = await supabase
        .from('google_calendar_events')
        .select('id, title, start_time, location, contacts(name, slug)')
        .or(`title.ilike.${searchTerm}`)
        .eq('hidden', false)
        .limit(5);

      if (gcalEvents) {
        for (const ev of gcalEvents) {
          const contactSlug = (ev.contacts as any)?.slug;
          const contactName = (ev.contacts as any)?.name;

          results.push({
            id: ev.id,
            type: 'activity',
            title: ev.title,
            subtitle: `${contactName || 'Meeting'} • ${new Date(ev.start_time).toLocaleDateString()}`,
            route: contactSlug ? `/people/${contactSlug}` : '/contacts',
          });
        }
      }

      return results;
    },
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}
