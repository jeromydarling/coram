import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface PartnershipAngle {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePartnershipAngles() {
  return useQuery({
    queryKey: ['partnership-angles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partnership_angles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as PartnershipAngle[];
    }
  });
}

export function useAllPartnershipAngles() {
  return useQuery({
    queryKey: ['partnership-angles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partnership_angles')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as PartnershipAngle[];
    }
  });
}

export function useCreatePartnershipAngle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      // Get max sort_order
      const { data: maxOrder } = await supabase
        .from('partnership_angles')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const newSortOrder = (maxOrder?.sort_order || 0) + 1;
      
      const { data: result, error } = await supabase
        .from('partnership_angles')
        .insert({ ...data, sort_order: newSortOrder })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnership-angles'] });
      toast.success('Partnership angle created');
    },
    onError: (error) => {
      toast.error(`Failed to create partnership angle: ${error.message}`);
    }
  });
}

export function useUpdatePartnershipAngle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; color?: string; is_active?: boolean; sort_order?: number }) => {
      const { data: result, error } = await supabase
        .from('partnership_angles')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnership-angles'] });
      toast.success('Partnership angle updated');
    },
    onError: (error) => {
      toast.error(`Failed to update partnership angle: ${error.message}`);
    }
  });
}
