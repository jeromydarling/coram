/**
 * useSectors — CRUD hooks for the sector catalog (Gardener / admin use).
 *
 * WHAT: Manages the global sector catalog.
 * WHERE: Gardener settings, sector management UI.
 * WHY: Operators need to add/edit/remove sectors from the catalog.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { Database } from '@/integrations/supabase/types';

/** Fully typed Sector row — single source of truth from generated schema. */
export type Sector = Database['public']['Tables']['sectors']['Row'];

export interface SectorInput {
  name: string;
  category?: string | null;
  description?: string | null;
  color?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export function useSectors(activeOnly = false) {
  return useQuery({
    queryKey: ['sectors', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('sectors')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Sector[];
    }
  });
}

export function useCreateSector() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: SectorInput) => {
      const { data, error } = await supabase
        .from('sectors')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Sector created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create sector: ${error.message}`);
    }
  });
}

export function useUpdateSector() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<SectorInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('sectors')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Sector updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update sector: ${error.message}`);
    }
  });
}

export function useDeleteSector() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Sector deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete sector: ${error.message}`);
    }
  });
}
