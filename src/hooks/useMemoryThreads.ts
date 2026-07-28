import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MemoryChapter {
  title: string;
  window_start: string;
  window_end: string;
  themes: string[];
  highlights: Array<{ type: string; text: string; source_url?: string }>;
  partners_involved: Array<{ opportunity_id: string; name: string }>;
}

export interface MemoryEcho {
  title: string;
  text: string;
  lookback_window: string;
  evidence: Array<{ type: string; date?: string; source_url?: string }>;
}

export interface MemoryCheckin {
  opportunity_id: string;
  reason: string;
  suggested_subject: string;
  suggested_body: string;
}

export interface MemoryJson {
  headline: string;
  chapters: MemoryChapter[];
  echoes: MemoryEcho[];
  checkins: MemoryCheckin[];
  metrics: { provisions_count: number; signals_count: number; events_count: number; grants_count: number };
}

export function useMemoryThread(scope: 'opportunity' | 'metro', id: string | undefined) {
  return useQuery({
    queryKey: ['memory-thread', scope, id],
    queryFn: async (): Promise<{ memory: MemoryJson | null; computed_at: string | null }> => {
      if (!id) return { memory: null, computed_at: null };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { memory: null, computed_at: null };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ scope, id }),
        },
      );

      if (!resp.ok) return { memory: null, computed_at: null };
      const result = await resp.json();
      return { memory: result.memory || null, computed_at: result.computed_at || null };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 15,
  });
}

export function useSaveEmailDraft() {
  return useMutation({
    mutationFn: async (params: {
      opportunity_id?: string;
      subject: string;
      body: string;
      context?: Record<string, unknown>;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-email-draft-create`,
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
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to save draft');
      }

      return resp.json();
    },
  });
}
