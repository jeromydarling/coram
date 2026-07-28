import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit, computeChanges } from './useAuditLog';

export interface Region {
  id: string;
  region_id: string;
  name: string;
  color: string | null;
  lead_user_id: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RegionWithLead extends Region {
  lead_name?: string | null;
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Region[];
    }
  });
}

export function useRegionsWithLeads() {
  return useQuery({
    queryKey: ['regions-with-leads'],
    queryFn: async () => {
      // Fetch regions
      const { data: regions, error: regionsError } = await supabase
        .from('regions')
        .select('*')
        .order('name', { ascending: true });
      
      if (regionsError) throw regionsError;

      // Fetch profiles (use public view to avoid exposing sensitive tokens)
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name');

      const profileMap = new Map<string, string>();
      profiles?.forEach(p => {
        if (p.user_id && p.display_name) {
          profileMap.set(p.user_id, p.display_name);
        }
      });

      // Enrich regions with lead names
      return (regions || []).map(region => ({
        ...region,
        lead_name: region.lead_user_id ? profileMap.get(region.lead_user_id) || null : null
      })) as RegionWithLead[];
    }
  });
}

export function useUpdateRegion() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, _previousData, ...region }: {
      id: string;
      _previousData?: Record<string, unknown>;
      name?: string;
      color?: string | null;
      lead_user_id?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('regions')
        .update(region)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { data, previousData: _previousData };
    },
    onSuccess: ({ data, previousData }) => {
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      queryClient.invalidateQueries({ queryKey: ['regions-with-leads'] });
      toast.success('Region updated successfully');
      
      const changes = previousData 
        ? computeChanges(previousData, data as unknown as Record<string, unknown>)
        : null;
      
      logAudit.mutate({
        action: 'update',
        entityType: 'region',
        entityId: data.id,
        entityName: data.name,
        changes: changes || undefined
      });
    },
    onError: (error) => {
      toast.error(`Failed to update region: ${error.message}`);
    }
  });
}

export function useCreateRegion() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (region: {
      region_id: string;
      name: string;
      color?: string;
      lead_user_id?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('regions')
        .insert(region)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      queryClient.invalidateQueries({ queryKey: ['regions-with-leads'] });
      toast.success('Region created successfully');
      
      logAudit.mutate({
        action: 'create',
        entityType: 'region',
        entityId: data.id,
        entityName: data.name
      });
    },
    onError: (error) => {
      toast.error(`Failed to create region: ${error.message}`);
    }
  });
}

export function useDeleteRegion() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('regions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, name };
    },
    onSuccess: ({ id, name }) => {
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      queryClient.invalidateQueries({ queryKey: ['regions-with-leads'] });
      queryClient.invalidateQueries({ queryKey: ['metros'] });
      queryClient.invalidateQueries({ queryKey: ['metros-computed'] });
      toast.success('Region deleted successfully');
      
      logAudit.mutate({
        action: 'delete',
        entityType: 'region',
        entityId: id,
        entityName: name
      });
    },
    onError: (error) => {
      toast.error(`Failed to delete region: ${error.message}`);
    }
  });
}
