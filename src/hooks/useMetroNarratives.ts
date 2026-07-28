import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetroNarrative {
  id: string;
  metro_id: string;
  headline: string | null;
  narrative_md: string | null;
  narrative_json: {
    headline?: string;
    community_story?: string;
    partner_story?: string;
    emerging_patterns?: string[];
    gentle_outlook?: string;
    on_the_ground?: string[];
    detected_patterns?: string[];
    cross_metro_signals?: unknown[];
    partner_response_clusters?: Array<{ org_name: string; trend: string | null }>;
  } | null;
  source_summary: {
    org_count?: number;
    external_signal_count?: number;
    ecosystem_pattern_count?: number;
    rising_orgs?: number;
  } | null;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  version: number;
  ai_generated: boolean;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  metro_id: string | null;
  narrative_id: string | null;
  block_id: string | null;
  anchor_key: string | null;
  note_text: string;
  visibility: string;
  created_at: string;
  updated_at: string;
}

export function useMetroNarratives(metroId: string | undefined) {
  return useQuery({
    queryKey: ['metro-narratives', metroId],
    queryFn: async (): Promise<MetroNarrative[]> => {
      if (!metroId) return [];
      const { data, error } = await supabase
        .from('metro_narratives')
        .select('*')
        .eq('metro_id', metroId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as MetroNarrative[];
    },
    enabled: !!metroId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useLatestMetroNarrative(metroId: string | undefined) {
  return useQuery({
    queryKey: ['metro-narrative-latest', metroId],
    queryFn: async (): Promise<MetroNarrative | null> => {
      if (!metroId) return null;
      const { data, error } = await supabase
        .from('metro_narratives')
        .select('*')
        .eq('metro_id', metroId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MetroNarrative | null;
    },
    enabled: !!metroId,
    staleTime: 1000 * 60 * 10,
  });
}

// Journal entries for a narrative
export function useJournalEntries(narrativeId: string | undefined) {
  return useQuery({
    queryKey: ['journal-entries', narrativeId],
    queryFn: async (): Promise<JournalEntry[]> => {
      if (!narrativeId) return [];
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('narrative_id', narrativeId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as JournalEntry[];
    },
    enabled: !!narrativeId,
    staleTime: 1000 * 60 * 2,
  });
}

// All journal entries for a metro (not tied to specific narrative)
export function useMetroJournalEntries(metroId: string | undefined) {
  return useQuery({
    queryKey: ['journal-entries-metro', metroId],
    queryFn: async (): Promise<JournalEntry[]> => {
      if (!metroId) return [];
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('metro_id', metroId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as JournalEntry[];
    },
    enabled: !!metroId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      narrative_id?: string;
      block_id?: string;
      anchor_key?: string;
      note_text: string;
      metro_id?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journal-create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        },
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to create journal entry');
      }

      return resp.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries', variables.narrative_id] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries-metro', variables.metro_id] });
    },
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries-metro'] });
    },
  });
}
