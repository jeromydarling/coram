import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface GrantAlignment {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GrantAlignmentInput {
  name: string;
  description?: string | null;
  color?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export function useGrantAlignments(activeOnly = false) {
  return useQuery({
    queryKey: ['grant_alignments', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('grant_alignments')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as GrantAlignment[];
    }
  });
}

export function useCreateGrantAlignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: GrantAlignmentInput) => {
      const { data, error } = await supabase
        .from('grant_alignments')
        .insert(input as never)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant_alignments'] });
      toast.success('Grant alignment created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create grant alignment: ${error.message}`);
    }
  });
}

export function useUpdateGrantAlignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<GrantAlignmentInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('grant_alignments')
        .update(input as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant_alignments'] });
      toast.success('Grant alignment updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update grant alignment: ${error.message}`);
    }
  });
}

export function useDeleteGrantAlignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('grant_alignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant_alignments'] });
      toast.success('Grant alignment deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete grant alignment: ${error.message}`);
    }
  });
}
