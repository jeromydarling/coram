import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface MetroNewsSource {
  id: string;
  metro_id: string;
  url: string;
  label: string | null;
  source_origin: 'auto_discovered' | 'manual';
  enabled: boolean;
  created_by: string | null;
  last_crawled_at: string | null;
  last_status: 'ok' | 'warning' | 'error' | null;
  last_error: string | null;
  detected_feed_type: 'rss' | 'html' | 'unknown' | null;
  failure_count: number;
  auto_disabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useMetroNewsSources(metroId?: string | null) {
  return useQuery({
    queryKey: ['metro-news-sources', metroId ?? 'all'],
    queryFn: async (): Promise<MetroNewsSource[]> => {
      let query = supabase
        .from('metro_news_sources')
        .select('*')
        .order('created_at', { ascending: false });
      if (metroId) {
        query = query.eq('metro_id', metroId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as MetroNewsSource[];
    },
  });
}

export function useAddMetroNewsSource() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ url, label, metroId }: { url: string; label?: string; metroId: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('metro_news_sources')
        .insert({
          metro_id: metroId,
          url,
          label: label || null,
          source_origin: 'manual',
          created_by: user.id,
          enabled: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metro-news-sources'] });
      toast.success('News source added');
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
}

export function useToggleMetroNewsSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('metro_news_sources')
        .update({ enabled } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metro-news-sources'] });
    },
  });
}

export function useDeleteMetroNewsSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('metro_news_sources')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metro-news-sources'] });
      toast.success('Source removed');
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
}

// Ingestion log — reads discovery_highlights for metro_news module
export interface MetroNewsHighlight {
  id: string;
  run_id: string;
  module: string;
  kind: string;
  payload: {
    title?: string;
    snippet?: string;
    source_url?: string;
    published_date?: string;
    community_impact_tags?: string[];
    metro_id?: string;
  };
  created_at: string;
}

export function useMetroNewsIngestionLog(metroId?: string | null) {
  return useQuery({
    queryKey: ['metro-news-ingestion', metroId ?? 'all'],
    queryFn: async (): Promise<MetroNewsHighlight[]> => {
      let query = supabase
        .from('discovery_highlights')
        .select('*')
        .eq('module', 'metro_news')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;

      let results = (data || []) as unknown as MetroNewsHighlight[];

      // Client-side filter by metro if needed (payload contains metro_id)
      if (metroId) {
        results = results.filter(r => r.payload?.metro_id === metroId);
      }

      return results;
    },
  });
}
