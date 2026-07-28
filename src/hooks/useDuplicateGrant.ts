import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';
import { Grant, GrantInput } from './useGrants';

function generateGrantId(): string {
  return 'GR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function useDuplicateGrant() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (sourceGrant: Grant) => {
      // Create a new grant with copied data
      const duplicatedData = {
        grant_id: generateGrantId(),
        grant_name: sourceGrant.grant_name,
        funder_name: sourceGrant.funder_name,
        funder_type: sourceGrant.funder_type,
        star_rating: sourceGrant.star_rating,
        opportunity_id: sourceGrant.opportunity_id,
        metro_id: sourceGrant.metro_id,
        owner_id: sourceGrant.owner_id,
        stage: 'Researching' as const, // Reset stage for new application cycle
        status: 'Active' as const,
        amount_requested: sourceGrant.amount_requested,
        amount_awarded: null, // Reset - new year hasn't been awarded yet
        fiscal_year: (sourceGrant.fiscal_year || new Date().getFullYear()) + 1, // Increment year
        grant_term_start: null, // Reset dates for new cycle
        grant_term_end: null,
        is_multiyear: sourceGrant.is_multiyear,
        grant_types: sourceGrant.grant_types || [],
        strategic_focus: sourceGrant.strategic_focus || [],
        match_required: sourceGrant.match_required,
        reporting_required: sourceGrant.reporting_required,
        reporting_frequency: sourceGrant.reporting_frequency,
        notes: sourceGrant.notes,
        internal_strategy_notes: sourceGrant.internal_strategy_notes,
      };
      
      const { data, error } = await supabase
        .from('grants')
        .insert(duplicatedData as never)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log audit
      await logAudit.mutateAsync({
        action: 'duplicate',
        entityType: 'grant',
        entityId: data.id,
        entityName: `${duplicatedData.grant_name} (FY${duplicatedData.fiscal_year})`,
        changes: { 
          source_grant_id: { old: null, new: sourceGrant.id },
          fiscal_year: { old: sourceGrant.fiscal_year, new: duplicatedData.fiscal_year }
        }
      });
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      toast.success(`Grant duplicated for FY${data.fiscal_year}`, {
        description: 'The grant has been copied. Review and update the details.'
      });
      return data;
    },
    onError: (error) => {
      toast.error(`Failed to duplicate grant: ${error.message}`);
    }
  });
}
