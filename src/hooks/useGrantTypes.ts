import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface GrantType {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GrantTypeInput {
  name: string;
  description?: string | null;
  color?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export function useGrantTypes(activeOnly = false) {
  return useQuery({
    queryKey: ['grant_types', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('grant_types')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as GrantType[];
    }
  });
}

export function useCreateGrantType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: GrantTypeInput) => {
      const { data, error } = await supabase
        .from('grant_types')
        .insert(input as never)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant_types'] });
      toast.success('Grant type created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create grant type: ${error.message}`);
    }
  });
}

export function useUpdateGrantType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<GrantTypeInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('grant_types')
        .update(input as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant_types'] });
      toast.success('Grant type updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update grant type: ${error.message}`);
    }
  });
}

export function useDeleteGrantType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('grant_types')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant_types'] });
      toast.success('Grant type deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete grant type: ${error.message}`);
    }
  });
}
