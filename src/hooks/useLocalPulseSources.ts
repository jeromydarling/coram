import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface LocalPulseSource {
  id: string;
  user_id: string;
  metro_id: string;
  source_type: 'auto' | 'url';
  url: string | null;
  label: string | null;
  enabled: boolean;
  last_checked_at: string | null;
  last_status: 'ok' | 'warning' | 'failed' | null;
  last_error: string | null;
  detected_feed_type: 'rss' | 'ics' | 'html' | 'unknown' | null;
  created_at: string;
  updated_at: string;
}

export function useLocalPulseSources(metroId: string | null) {
  return useQuery({
    queryKey: ['local-pulse-sources', metroId],
    queryFn: async (): Promise<LocalPulseSource[]> => {
      if (!metroId) return [];
      const { data, error } = await supabase
        .from('local_pulse_sources')
        .select('*')
        .eq('metro_id', metroId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LocalPulseSource[];
    },
    enabled: !!metroId,
  });
}

export function useAddLocalPulseSource() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ url, label, metroId }: { url: string; label?: string; metroId: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('local_pulse_sources')
        .insert({
          user_id: user.id,
          metro_id: metroId,
          source_type: 'url',
          url,
          label: label || null,
          enabled: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['local-pulse-sources', vars.metroId] });
      toast.success('Source added');
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
}

export function useToggleLocalPulseSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled, metroId }: { id: string; enabled: boolean; metroId: string }) => {
      const { error } = await supabase
        .from('local_pulse_sources')
        .update({ enabled } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['local-pulse-sources', vars.metroId] });
    },
  });
}

export function useDeleteLocalPulseSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, metroId }: { id: string; metroId: string }) => {
      const { error } = await supabase
        .from('local_pulse_sources')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['local-pulse-sources', vars.metroId] });
      toast.success('Source removed');
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
}
