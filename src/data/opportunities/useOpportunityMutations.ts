/**
 * useCreateOpportunity / useUpdateOpportunity — Tenant-scoped mutations.
 *
 * WHAT: Create and update rows in `public.opportunities`, log audit, and
 *       capture journey-stage changes into Impulsus.
 * WHERE: Used by OpportunityModal, OpportunityDetail, bulk edit, etc.
 * WHY: Centralizes invalidation so every reader of the opportunities
 *      cache (list, detail, dashboards) refreshes consistently.
 *
 * Invalidation contract: invalidates `queryKeys.opportunities.all(tenantId)`,
 * which is a prefix of both `.list()` and `.detail()` keys — refreshes
 * everything in the domain.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { crosToast } from '@/lib/crosToast';
import { handleMutationError } from '@/lib/permissionErrors';
import { useLogAudit, computeChanges } from '@/hooks/useAuditLog';
import { useImpulsusCapture } from '@/hooks/useImpulsusCapture';

type OpportunityStage =
  | 'Target Identified' | 'Contacted' | 'Discovery Scheduled' | 'Discovery Held'
  | 'Proposal Sent' | 'Agreement Pending' | 'Agreement Signed'
  | 'First Volume' | 'Stable Producer' | 'Closed - Not a Fit';

type OpportunityStatus = 'Active' | 'On Hold' | 'Closed - Won' | 'Closed - Lost';

type PartnerTier =
  | 'Anchor' | 'Distribution' | 'Referral'
  | 'Workforce' | 'Housing' | 'Education' | 'Other';

export interface CreateOpportunityInput {
  opportunity_id: string;
  organization: string;
  metro_id?: string;
  stage?: OpportunityStage;
  status?: OpportunityStatus;
  partner_tier?: PartnerTier;
  partner_tiers?: string[];
  grant_alignment?: string[];
  mission_snapshot?: string[];
  best_partnership_angle?: string[];
  primary_contact_id?: string | null;
  primary_contact_name?: string;
  primary_contact_title?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  next_action_due?: string;
  next_step?: string;
  notes?: string;
  website_url?: string | null;
}

export interface UpdateOpportunityInput extends Partial<CreateOpportunityInput> {
  id: string;
  _previousData?: Record<string, unknown>;
}

function useInvalidateOpportunities() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return () => {
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all(tenantId) });
    } else {
      // Fallback — invalidate everything under the legacy prefix.
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
  };
}

export function useCreateOpportunity() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidateOpportunities();

  return useMutation({
    mutationFn: async (opportunity: CreateOpportunityInput) => {
      const { data, error } = await supabase
        .from('opportunities')
        .insert(opportunity)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidate();
      crosToast.noted('Partner added');

      logAudit.mutate({
        action: 'create',
        entityType: 'opportunity',
        entityId: data.id,
        entityName: data.organization,
      });
    },
    onError: (error: Error) => {
      handleMutationError(error, () =>
        crosToast.gentle(`Something didn't go through: ${error.message}`),
      );
    },
  });
}

export function useUpdateOpportunity() {
  const logAudit = useLogAudit();
  const { captureImpulsus } = useImpulsusCapture();
  const invalidate = useInvalidateOpportunities();

  return useMutation({
    mutationFn: async ({ id, _previousData, ...opportunity }: UpdateOpportunityInput) => {
      const { data, error } = await supabase
        .from('opportunities')
        .update(opportunity)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, previousData: _previousData };
    },
    onSuccess: ({ data, previousData }) => {
      invalidate();
      crosToast.updated();

      const changes = previousData
        ? computeChanges(previousData, data as Record<string, unknown>)
        : null;

      logAudit.mutate({
        action: 'update',
        entityType: 'opportunity',
        entityId: data.id,
        entityName: data.organization,
        changes: changes || undefined,
      });

      // Capture journey stage change
      const oldStage = previousData?.stage as string | undefined;
      const newStage = data.stage as string | undefined;
      if (oldStage && newStage && oldStage !== newStage) {
        const ts = new Date().toISOString();
        captureImpulsus({
          kind: 'journey',
          opportunityId: data.id,
          metroId: data.metro_id || undefined,
          dedupeKey: `journey:${data.id}:${oldStage}->${newStage}:${ts}`,
          source: { from_stage: oldStage, to_stage: newStage },
          context: { orgName: data.organization, fromStage: oldStage, toStage: newStage },
        });
      }
    },
    onError: (error: Error) => {
      handleMutationError(error, () =>
        crosToast.gentle(`Something didn't go through: ${error.message}`),
      );
    },
  });
}
