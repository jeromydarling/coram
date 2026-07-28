/**
 * useCreateEvent / useUpdateEvent / useDuplicateEvent — Event mutations.
 *
 * WHAT: Insert/update rows in `public.events` with audit logging.
 * WHERE: Used by EventModal, calendar create flows, duplicate actions.
 * WHY: Centralized invalidation so list, calendar, and dashboard caches
 *      refresh together.
 *
 * Invalidation contract: `queryKeys.events.all(tenantId)` (prefix
 * `['events', tenantId]`) — falls back to `['events']` for global match
 * when tenant is unknown, which also catches the `allTenants` cache.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { crosToast } from '@/lib/crosToast';
import { handleMutationError } from '@/lib/permissionErrors';
import { useLogAudit, computeChanges } from '@/hooks/useAuditLog';

type GrantValue = 'High' | 'Medium' | 'Low';

interface BaseEventFields {
  event_name: string;
  event_date: string;
  end_date?: string | null;
  metro_id?: string | null;
  host_opportunity_id?: string | null;
  event_type?: string | null;
  staff_deployed?: number | null;
  households_served?: number | null;
  devices_distributed?: number | null;
  internet_signups?: number | null;
  referrals_generated?: number | null;
  cost_estimated?: number | null;
  anchor_identified_yn?: boolean | null;
  followup_meeting_yn?: boolean | null;
  grant_narrative_value?: GrantValue | null;
  notes?: string | null;
  city?: string | null;
  host_organization?: string | null;
  target_populations?: string[] | null;
  strategic_lanes?: string[] | null;
  pcs_goals?: string[] | null;
  priority?: string | null;
  status?: string | null;
  travel_required?: string | null;
  expected_households?: string | null;
  expected_referrals?: string | null;
  anchor_potential?: string | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_end_date?: string | null;
  description?: string | null;
  is_conference?: boolean | null;
}

export interface CreateEventInput extends BaseEventFields {
  event_id: string;
}

export interface UpdateEventInput extends Partial<BaseEventFields> {
  id: string;
  _previousData?: Record<string, unknown>;
  attended?: boolean | null;
}

export type DuplicateEventInput = BaseEventFields;

function useInvalidateEvents() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return () => {
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all(tenantId) });
    }
    // Always also broadcast to the legacy `['events']` prefix so any
    // `allTenants` / `mineOnly` variants and legacy callers refresh.
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };
}

export function useCreateEvent() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidateEvents();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (event: CreateEventInput) => {
      const { data, error } = await supabase
        .from('events')
        .insert({
          ...event,
          tenant_id: tenantId || undefined,
          attended_by: user?.id || undefined,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidate();
      crosToast.noted('Event recorded');
      logAudit.mutate({
        action: 'create',
        entityType: 'event',
        entityId: data.id,
        entityName: data.event_name,
      });
    },
    onError: (error) => {
      handleMutationError(error, () => crosToast.gentle(`Something didn't go through: ${error.message}`));
    },
  });
}

export function useUpdateEvent() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidateEvents();

  return useMutation({
    mutationFn: async ({ id, _previousData, ...event }: UpdateEventInput) => {
      const { data, error } = await supabase
        .from('events')
        .update(event)
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
        entityType: 'event',
        entityId: data.id,
        entityName: data.event_name,
        changes: changes || undefined,
      });
    },
    onError: (error) => {
      handleMutationError(error, () => crosToast.gentle(`Something didn't go through: ${error.message}`));
    },
  });
}

export function useDuplicateEvent() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidateEvents();

  return useMutation({
    mutationFn: async (event: DuplicateEventInput) => {
      const eventId = `EVT-${Date.now()}`;
      const payload: Record<string, unknown> = { event_id: eventId };
      for (const [k, v] of Object.entries(event)) {
        payload[k] = v ?? undefined;
      }

      const { data, error } = await supabase
        .from('events')
        .insert(payload as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidate();
      crosToast.noted('Event duplicated');
      logAudit.mutate({
        action: 'create',
        entityType: 'event',
        entityId: data.id,
        entityName: `${data.event_name} (duplicate)`,
      });
    },
    onError: (error) => {
      handleMutationError(error, () => crosToast.gentle(`Something didn't go through: ${error.message}`));
    },
  });
}
