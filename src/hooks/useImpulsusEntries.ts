/**
 * useImpulsusEntries — infinite-scroll query hook.
 *
 * WHAT: Fetches impulsus_entries with cursor pagination + optional kind filter + FTS search.
 * WHERE: Used by ImpulsusTimeline component.
 * WHY: Provides the data layer for the Impulsus scrapbook page.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ImpulsusKind } from '@/lib/impulsusTemplates';

export interface ImpulsusEntry {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  metro_id: string | null;
  kind: ImpulsusKind;
  occurred_at: string;
  title: string;
  narrative: string;
  tags: string[];
  source: Record<string, unknown>;
  dedupe_key: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

interface UseImpulsusEntriesOptions {
  kind?: ImpulsusKind;
  search?: string;
}

export function useImpulsusEntries(options: UseImpulsusEntriesOptions = {}) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['impulsus-entries', user?.id, options.kind, options.search],
    queryFn: async ({ pageParam }): Promise<ImpulsusEntry[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('impulsus_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (options.kind) {
        query = query.eq('kind', options.kind);
      }

      if (options.search && options.search.trim().length > 0) {
        // Use ilike for simple search; GIN index backs to_tsvector but
        // PostgREST textSearch requires a generated column. ilike is simpler
        // and still fast for small result sets scoped by user_id.
        const term = `%${options.search.trim()}%`;
        query = query.or(`title.ilike.${term},narrative.ilike.${term}`);
      }

      if (pageParam) {
        query = query.lt('occurred_at', pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ImpulsusEntry[];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE
        ? lastPage[lastPage.length - 1].occurred_at
        : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!user?.id,
  });
}
