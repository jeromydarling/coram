import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';

export interface GrantAnchorLink {
  id: string;
  grant_id: string;
  anchor_id: string;
  link_type: 'funded' | 'supported' | 'influenced';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  grants?: {
    grant_name: string;
    funder_name: string;
    amount_awarded: number | null;
    grant_term_start: string | null;
    stage: string;
  };
  anchors?: {
    anchor_id: string;
    anchor_tier: string | null;
    first_volume_date: string | null;
    avg_monthly_volume: number | null;
    opportunities?: {
      organization: string;
    };
    metros?: {
      metro: string;
    };
  };
}

// Get all links for a specific grant
export function useGrantAnchorLinks(grantId: string | null) {
  return useQuery({
    queryKey: ['grant-anchor-links', 'grant', grantId],
    queryFn: async () => {
      if (!grantId) return [];
      
      const { data, error } = await supabase
        .from('grant_anchor_links')
        .select(`
          *,
          anchors (
            anchor_id,
            anchor_tier,
            first_volume_date,
            avg_monthly_volume,
            opportunities (organization),
            metros (metro)
          )
        `)
        .eq('grant_id', grantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GrantAnchorLink[];
    },
    enabled: !!grantId
  });
}

// Get all links for a specific anchor
export function useAnchorGrantLinks(anchorId: string | null) {
  return useQuery({
    queryKey: ['grant-anchor-links', 'anchor', anchorId],
    queryFn: async () => {
      if (!anchorId) return [];
      
      const { data, error } = await supabase
        .from('grant_anchor_links')
        .select(`
          *,
          grants (
            grant_name,
            funder_name,
            amount_awarded,
            grant_term_start,
            stage
          )
        `)
        .eq('anchor_id', anchorId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GrantAnchorLink[];
    },
    enabled: !!anchorId
  });
}

// Create a new link
export function useCreateGrantAnchorLink() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (link: {
      grant_id: string;
      anchor_id: string;
      link_type?: 'funded' | 'supported' | 'influenced';
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('grant_anchor_links')
        .insert(link)
        .select(`
          *,
          anchors (
            anchor_id,
            opportunities (organization)
          ),
          grants (grant_name)
        `)
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grant-anchor-links'] });
      toast.success('Anchor linked to grant');
      
      const anchorName = (data as any).anchors?.opportunities?.organization || (data as any).anchors?.anchor_id;
      const grantName = (data as any).grants?.grant_name;
      
      logAudit.mutate({
        action: 'create',
        entityType: 'grant_anchor_link',
        entityId: data.id,
        entityName: `${grantName} ↔ ${anchorName}`
      });
    },
    onError: (error) => {
      if (error.message.includes('duplicate')) {
        toast.error('This anchor is already linked to this grant');
      } else {
        toast.error(`Failed to link anchor: ${error.message}`);
      }
    }
  });
}

// Update a link
export function useUpdateGrantAnchorLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      link_type?: 'funded' | 'supported' | 'influenced';
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('grant_anchor_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant-anchor-links'] });
      toast.success('Link updated');
    },
    onError: (error) => {
      toast.error(`Failed to update link: ${error.message}`);
    }
  });
}

// Delete a link
export function useDeleteGrantAnchorLink() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, entityName }: { id: string; entityName?: string }) => {
      const { error } = await supabase
        .from('grant_anchor_links')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, entityName };
    },
    onSuccess: ({ id, entityName }) => {
      queryClient.invalidateQueries({ queryKey: ['grant-anchor-links'] });
      toast.success('Anchor unlinked from grant');
      
      logAudit.mutate({
        action: 'delete',
        entityType: 'grant_anchor_link',
        entityId: id,
        entityName
      });
    },
    onError: (error) => {
      toast.error(`Failed to unlink: ${error.message}`);
    }
  });
}
