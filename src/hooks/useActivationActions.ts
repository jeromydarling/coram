/**
 * useActivationActions — Manages gentle activation checklist items.
 *
 * WHAT: CRUD for metro_activation_actions per metro per tenant.
 * WHERE: ActivationChecklist component.
 * WHY: Pre-seeded actions guide first presence without urgency.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export interface ActivationAction {
  id: string;
  tenant_id: string;
  metro_id: string;
  action_type: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

const DEFAULT_ACTIONS = [
  { action_type: 'first_event_attended', label: 'Attend one local event' },
  { action_type: 'first_partner_contact', label: 'Introduce yourself to one organization' },
  { action_type: 'first_reflection', label: 'Write one reflection about the metro' },
  { action_type: 'local_meeting', label: 'Join one community gathering' },
  { action_type: 'community_research', label: 'Research local community needs' },
  { action_type: 'email_introduction', label: 'Send one introductory email' },
];

export function useActivationActions(metroId: string | null) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = (tenant as any)?.id;
  const queryClient = useQueryClient();
  const queryKey = ['activation-actions', metroId, tenantId];

  const { data: actions, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!metroId || !tenantId) return [];
      const { data, error } = await supabase
        .from('metro_activation_actions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('metro_id', metroId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ActivationAction[];
    },
    enabled: !!metroId && !!tenantId,
  });

  /** Seed default actions if none exist */
  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!metroId || !tenantId || !user?.id) return;
      const rows = DEFAULT_ACTIONS.map(a => ({
        tenant_id: tenantId,
        metro_id: metroId,
        action_type: a.action_type,
        label: a.label,
        created_by: user.id,
      }));
      const { error } = await supabase
        .from('metro_activation_actions')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggleAction = useMutation({
    mutationFn: async ({ actionId, completed }: { actionId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('metro_activation_actions')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', actionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    actions: actions || [],
    isLoading,
    seedDefaults,
    toggleAction,
  };
}
