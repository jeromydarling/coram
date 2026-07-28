import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Database } from '@/integrations/supabase/types';

// Define valid lookup table names
export type LookupTableName = 
  | 'grant_alignments'
  | 'mission_snapshots'
  | 'partnership_angles'
  | 'sectors';

// Common lookup item interface
export interface LookupItem {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LookupItemInput {
  name: string;
  description?: string | null;
  color?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

// Display names for toast messages
const tableDisplayNames: Record<LookupTableName, string> = {
  grant_alignments: 'Grant alignment',
  mission_snapshots: 'Mission snapshot',
  partnership_angles: 'Partnership angle',
  sectors: 'Sector',
};

/**
 * Generic hook for fetching lookup table data
 */
export function useLookupTable(tableName: LookupTableName, activeOnly = false) {
  return useQuery({
    queryKey: [tableName, activeOnly],
    queryFn: async () => {
      let query = supabase
        .from(tableName)
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as LookupItem[];
    }
  });
}

/**
 * Generic hook for creating lookup table items
 */
export function useCreateLookupItem(tableName: LookupTableName) {
  const queryClient = useQueryClient();
  const displayName = tableDisplayNames[tableName];
  
  return useMutation({
    mutationFn: async (input: LookupItemInput) => {
      // Get max sort_order
      const { data: maxOrder } = await supabase
        .from(tableName)
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const newSortOrder = (maxOrder?.sort_order || 0) + 1;
      
      const { data, error } = await supabase
        .from(tableName)
        .insert({ ...input, sort_order: newSortOrder } as never)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast.success(`${displayName} created successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to create ${displayName.toLowerCase()}: ${error.message}`);
    }
  });
}

/**
 * Generic hook for updating lookup table items
 */
export function useUpdateLookupItem(tableName: LookupTableName) {
  const queryClient = useQueryClient();
  const displayName = tableDisplayNames[tableName];
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<LookupItemInput> & { id: string }) => {
      const { data, error } = await supabase
        .from(tableName)
        .update(input as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast.success(`${displayName} updated successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to update ${displayName.toLowerCase()}: ${error.message}`);
    }
  });
}

/**
 * Generic hook for deleting lookup table items
 */
export function useDeleteLookupItem(tableName: LookupTableName) {
  const queryClient = useQueryClient();
  const displayName = tableDisplayNames[tableName];
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast.success(`${displayName} deleted successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to delete ${displayName.toLowerCase()}: ${error.message}`);
    }
  });
}

// ============================================
// Convenience wrappers for backward compatibility
// ============================================

// Grant Alignments
export function useGrantAlignments(activeOnly = false) {
  return useLookupTable('grant_alignments', activeOnly);
}
export function useCreateGrantAlignment() {
  return useCreateLookupItem('grant_alignments');
}
export function useUpdateGrantAlignment() {
  return useUpdateLookupItem('grant_alignments');
}
export function useDeleteGrantAlignment() {
  return useDeleteLookupItem('grant_alignments');
}

// Mission Snapshots
export function useMissionSnapshots(activeOnly = true) {
  return useLookupTable('mission_snapshots', activeOnly);
}
export function useAllMissionSnapshots() {
  return useLookupTable('mission_snapshots', false);
}
export function useCreateMissionSnapshot() {
  return useCreateLookupItem('mission_snapshots');
}
export function useUpdateMissionSnapshot() {
  return useUpdateLookupItem('mission_snapshots');
}

// Partnership Angles
export function usePartnershipAngles(activeOnly = true) {
  return useLookupTable('partnership_angles', activeOnly);
}
export function useCreatePartnershipAngle() {
  return useCreateLookupItem('partnership_angles');
}
export function useUpdatePartnershipAngle() {
  return useUpdateLookupItem('partnership_angles');
}

// Sectors
export function useSectors(activeOnly = false) {
  return useLookupTable('sectors', activeOnly);
}
export function useCreateSector() {
  return useCreateLookupItem('sectors');
}
export function useUpdateSector() {
  return useUpdateLookupItem('sectors');
}
export function useDeleteSector() {
  return useDeleteLookupItem('sectors');
}
