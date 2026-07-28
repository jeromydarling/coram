/**
 * useRecoveryIntelligence — Hooks for recovery ticket creation and recent actions.
 *
 * WHAT: Creates recovery tickets and fetches recent actions for assistant context.
 * WHERE: AIChatDrawer, Help pages.
 * WHY: Enables calm, assistant-guided undo/restore without surveillance.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { fetchRecentActions, fetchTenantRecentActions } from '@/lib/eventStream';
import { sanitizeRecoveryActions } from '@/lib/sanitizeRecoveryContext';
import { toast } from '@/components/ui/sonner';

export function useRecentActions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-actions', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id) return [];
      return fetchRecentActions(user.id, 25);
    },
  });
}

export function useTenantRecentActions() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['tenant-recent-actions', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchTenantRecentActions(tenantId, 10);
    },
  });
}

export function useCreateRecoveryTicket() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      subject: string;
      description?: string;
      recentActions?: unknown[];
      suspectedEntityType?: string;
      suspectedEntityId?: string;
      currentRoute?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Sanitize recent actions before writing — strip PII for operator safety
      const safeActions = params.recentActions
        ? sanitizeRecoveryActions(params.recentActions)
        : [];

      const { data, error } = await supabase
        .from('recovery_tickets')
        .insert({
          user_id: user.id,
          tenant_id: tenantId ?? null,
          type: 'recovery_emergency',
          subject: params.subject,
          description: params.description ?? null,
          recent_actions: safeActions as any,
          suspected_entity_type: params.suspectedEntityType ?? null,
          suspected_entity_id: params.suspectedEntityId ?? null,
          current_route: params.currentRoute ?? (typeof window !== 'undefined' ? window.location.pathname : null),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Recovery request sent. A Gardener will review it soon.');
      qc.invalidateQueries({ queryKey: ['recovery-tickets'] });
    },
    onError: () => {
      toast.error('Could not submit recovery request. Please try again.');
    },
  });
}
