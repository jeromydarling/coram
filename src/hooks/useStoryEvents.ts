import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type StoryEventKind = 'reflection' | 'email' | 'campaign' | 'task';

export interface StoryEvent {
  id: string;
  kind: StoryEventKind;
  title: string;
  summary: string;
  occurred_at: string;
  author_label?: string;
  metadata?: Record<string, any>;
  privacy: 'private' | 'team';
}

/** Parse a timestamp safely; returns 0 for invalid/missing values */
function safeTime(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

const KIND_WEIGHT: Record<StoryEventKind, number> = { reflection: 3, task: 2.5, email: 2, campaign: 1 };

const PAGE_SIZE = 50;

export function useStoryEvents(
  opportunityId: string | null,
  filter: StoryEventKind | 'all' = 'all',
  page = 0,
) {
  return useQuery({
    queryKey: ['story-events', opportunityId, filter, page],
    queryFn: async (): Promise<StoryEvent[]> => {
      if (!opportunityId) return [];

      const offset = page * PAGE_SIZE;

      // Query the cached view
      let query = supabase
        .from('story_events_view')
        .select('id, opportunity_id, kind, title, summary, occurred_at, privacy_scope, author_id')
        .eq('opportunity_id', opportunityId)
        .order('occurred_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (filter !== 'all') {
        query = query.eq('kind', filter);
      }

      const { data: cacheRows, error } = await query;

      if (error) {
        console.error('[useStoryEvents] View query error:', error.message);
      }

      // Always fetch live reflections to ensure newly added ones appear immediately
      // (the materialized cache may be stale)
      let liveReflections: any[] = [];
      if (filter === 'all' || filter === 'reflection') {
        const { data: reflections } = await supabase
          .from('opportunity_reflections')
          .select('id, opportunity_id, body, visibility, created_at, author_id')
          .eq('opportunity_id', opportunityId)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        liveReflections = (reflections || []).map((r: any) => ({
          id: r.id,
          opportunity_id: r.opportunity_id,
          kind: 'reflection',
          title: 'Reflection',
          summary: (r.body || '').replace(/<[^>]*>/g, '').slice(0, 280),
          occurred_at: r.created_at,
          privacy_scope: r.visibility || 'team',
          author_id: r.author_id,
        }));
      }

      // Merge: live reflections take precedence over cache (by id)
      const seenIds = new Set<string>();
      const merged: any[] = [];
      for (const r of liveReflections) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          merged.push(r);
        }
      }
      for (const row of (cacheRows || [])) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          merged.push(row);
        }
      }

      const rows = merged;
      if (rows.length === 0) return [];

      // Resolve author labels for reflections
      const authorIds = [...new Set(
        (rows as any[])
          .filter((r: any) => r.kind === 'reflection' && r.author_id)
          .map((r: any) => r.author_id)
      )];

      let profilesMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, display_name')
          .in('user_id', authorIds);
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.display_name || 'Team member';
          return acc;
        }, {} as Record<string, string>);
      }

      // Map to StoryEvent
      const events: StoryEvent[] = (rows as any[]).map((row: any) => {
        let authorLabel = 'Team';
        if (row.kind === 'reflection') {
          authorLabel = profilesMap[row.author_id] || 'Team member';
        } else if (row.kind === 'email') {
          authorLabel = 'Email';
        } else if (row.kind === 'campaign') {
          authorLabel = 'Campaign';
        } else if (row.kind === 'task') {
          authorLabel = 'Task';
        }

        return {
          id: row.id,
          kind: row.kind as StoryEventKind,
          title: row.title || '',
          summary: row.summary || '',
          occurred_at: row.occurred_at ?? '',
          author_label: authorLabel,
          privacy: (row.privacy_scope as 'private' | 'team') || 'private',
        };
      });

      // Sort: primary by date DESC, secondary by weight DESC
      events.sort((a, b) => {
        const timeDiff = safeTime(b.occurred_at) - safeTime(a.occurred_at);
        if (timeDiff !== 0) return timeDiff;
        return (KIND_WEIGHT[b.kind] || 0) - (KIND_WEIGHT[a.kind] || 0);
      });

      // Deduplicate by stable ID
      const seen = new Set<string>();
      return events.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 5,
  });
}
