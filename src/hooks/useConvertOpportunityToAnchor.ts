import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';

// Check if an anchor already exists for the given opportunity
export function useAnchorExistsForOpportunity(opportunityId: string | null) {
  return useQuery({
    queryKey: ['anchor-exists', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return false;
      
      const { data, error } = await supabase
        .from('anchors')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!opportunityId
  });
}

// Get pipeline record for an opportunity (if exists)
export function usePipelineForOpportunity(opportunityId: string | null) {
  return useQuery({
    queryKey: ['pipeline-for-opportunity', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;
      
      const { data, error } = await supabase
        .from('anchor_pipeline')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!opportunityId
  });
}

interface ConversionData {
  opportunityId: string;
  organizationName: string;
  metroId?: string | null;
  anchorTier: 'Strategic' | 'Standard' | 'Pilot';
  agreementSignedDate: string;
  notes?: string;
}

export function useConvertOpportunityToAnchor() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (data: ConversionData) => {
      // 1. Generate anchor ID
      const anchorId = `ANC-${Date.now().toString(36).toUpperCase()}`;
      
      // 2. Create anchor record
      const { data: anchor, error: anchorError } = await supabase
        .from('anchors')
        .insert({
          anchor_id: anchorId,
          opportunity_id: data.opportunityId,
          metro_id: data.metroId,
          anchor_tier: data.anchorTier,
          agreement_signed_date: data.agreementSignedDate,
          notes: data.notes
        })
        .select(`
          *,
          opportunities (organization),
          metros (metro)
        `)
        .single();
      
      if (anchorError) throw anchorError;
      
      // 3. Update opportunity status to "Closed - Won"
      const { error: opportunityError } = await supabase
        .from('opportunities')
        .update({ status: 'Closed - Won' })
        .eq('id', data.opportunityId);
      
      if (opportunityError) throw opportunityError;
      
      // 4. Delete the pipeline record if exists
      const { error: deleteError } = await supabase
        .from('anchor_pipeline')
        .delete()
        .eq('opportunity_id', data.opportunityId);
      
      if (deleteError) {
        // Non-fatal: log but don't throw (pipeline might not exist)
        console.warn('Pipeline delete warning:', deleteError.message);
      }
      
      return { anchor, organizationName: data.organizationName };
    },
    onSuccess: ({ anchor, organizationName }) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['anchor-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['anchors'] });
      queryClient.invalidateQueries({ queryKey: ['anchor-exists'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-for-opportunity'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      
      toast.success(`${organizationName} converted to Anchor!`);
      
      // Log audit entries
      logAudit.mutate({
        action: 'create',
        entityType: 'anchor',
        entityId: anchor.id,
        entityName: `${organizationName} (converted from opportunity)`
      });
    },
    onError: (error) => {
      toast.error(`Failed to convert to anchor: ${error.message}`);
    }
  });
}
