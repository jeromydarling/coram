import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export function useMissionSnapshots() {
  return useQuery({
    queryKey: ['mission-snapshots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_snapshots')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });
}

export function useAllMissionSnapshots() {
  return useQuery({
    queryKey: ['mission-snapshots', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_snapshots')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateMissionSnapshot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (snapshot: {
      name: string;
      description?: string;
      color?: string;
      sort_order?: number;
    }) => {
      const { data, error } = await supabase
        .from('mission_snapshots')
        .insert(snapshot)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission-snapshots'] });
      toast.success('Mission snapshot created');
    },
    onError: (error) => {
      toast.error(`Failed to create mission snapshot: ${error.message}`);
    }
  });
}

export function useUpdateMissionSnapshot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      description?: string;
      color?: string;
      sort_order?: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('mission_snapshots')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission-snapshots'] });
      toast.success('Mission snapshot updated');
    },
    onError: (error) => {
      toast.error(`Failed to update mission snapshot: ${error.message}`);
    }
  });
}
