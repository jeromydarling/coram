/**
 * useCreateActivity / useUpdateActivity / useDeleteActivity — mutations.
 *
 * WHAT: Insert/update/delete rows in `public.activities` with audit logs.
 * WHERE: Used by activity forms, calendar quick-create, and detail timelines.
 * WHY: Centralized invalidation so list, calendar, and unified-activities
 *      caches refresh together.
 *
 * Invalidation contract: `queryKeys.activities.all(tenantId)` plus the
 * legacy `['activities']`, `['activities-calendar']`, `['unified-activities']`,
 * and `['calendar-data']` prefixes used across the app.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/components/ui/sonner';
import { handleMutationError } from '@/lib/permissionErrors';
import { useLogAudit, computeChanges } from '@/hooks/useAuditLog';
import type { Database } from '@/integrations/supabase/types';

type ActivityType = Database['public']['Enums']['activity_type'];
type ActivityOutcome = Database['public']['Enums']['activity_outcome'];

export interface CreateActivityInput {
  activity_id: string;
  activity_type: ActivityType;
  activity_date_time: string;
  outcome?: ActivityOutcome | null;
  notes?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  opportunity_id?: string | null;
  metro_id?: string | null;
  contact_id?: string | null;
  attended?: boolean | null;
  google_calendar_event_id?: string | null;
  google_calendar_synced_at?: string | null;
}

export interface UpdateActivityInput {
  id: string;
  _previousData?: Record<string, unknown>;
  activity_type?: ActivityType;
  activity_date_time?: string;
  outcome?: ActivityOutcome | null;
  notes?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  opportunity_id?: string | null;
  metro_id?: string | null;
  contact_id?: string | null;
  google_calendar_event_id?: string | null;
  google_calendar_synced_at?: string | null;
  attended?: boolean | null;
}

function useInvalidateActivities() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return (active = false) => {
    const opts = active ? { refetchType: 'active' as const } : undefined;
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all(tenantId), ...opts });
    }
    queryClient.invalidateQueries({ queryKey: ['activities'], ...opts });
    queryClient.invalidateQueries({ queryKey: ['activities-calendar'], ...opts });
    queryClient.invalidateQueries({ queryKey: ['unified-activities'], ...opts });
    queryClient.invalidateQueries({ queryKey: ['calendar-data'], ...opts });
  };
}

export function useCreateActivity() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidateActivities();

  return useMutation({
    mutationFn: async (activity: CreateActivityInput) => {
      const { data, error } = await supabase
        .from('activities')
        .insert(activity)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidate();
      toast.success('Activity created successfully');

      logAudit.mutate({
        action: 'create',
        entityType: 'activity',
        entityId: data.id,
        entityName: `${data.activity_type} on ${new Date(data.activity_date_time).toLocaleDateString()}`,
      });
    },
    onError: (error) => {
      handleMutationError(error, `Failed to create activity: ${error.message}`);
    },
  });
}

export function useUpdateActivity() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidateActivities();

  return useMutation({
    mutationFn: async ({ id, _previousData, ...activity }: UpdateActivityInput) => {
      const { data, error } = await supabase
        .from('activities')
        .update(activity)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, previousData: _previousData };
    },
    onSuccess: async ({ data, previousData }) => {
      invalidate(true);
      toast.success('Activity updated successfully');

      const changes = previousData
        ? computeChanges(previousData, data as Record<string, unknown>)
        : null;

      logAudit.mutate({
        action: 'update',
        entityType: 'activity',
        entityId: data.id,
        entityName: `${data.activity_type} on ${new Date(data.activity_date_time).toLocaleDateString()}`,
        changes: changes || undefined,
      });
    },
    onError: (error) => {
      handleMutationError(error, `Failed to update activity: ${error.message}`);
    },
  });
}

export function useDeleteActivity() {
  const logAudit = useLogAudit();
  const invalidate = useInvalidateActivities();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidate();
      toast.success('Activity deleted successfully');

      logAudit.mutate({
        action: 'delete',
        entityType: 'activity',
        entityId: id,
        entityName: 'Activity',
      });
    },
    onError: (error) => {
      handleMutationError(error, `Failed to delete activity: ${error.message}`);
    },
  });
}
