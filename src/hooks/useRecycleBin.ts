/**
 * useRecycleBin — Hooks for soft-delete and recycle bin operations.
 *
 * WHAT: Query/restore soft-deleted records from recycle_bin table.
 * WHERE: Activity feed (tenant) + Nexus Recovery (operator).
 * WHY: Gives humans a safety net for accidental deletions.
 *
 * ⚠️ PRIVACY NOTE: The operator recovery view (OperatorRecovery.tsx) uses a
 * separate query that fetches metadata only (no entity_name, no snapshot).
 * This hook is used by TENANT views where the user owns the data.
 * Never use this hook directly in operator/gardener surfaces.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';
import { useEmitRestorationSignal } from './useRestorationSignals';
import { logActionEvent } from '@/lib/eventStream';

export interface RecycleBinEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  tenant_id: string | null;
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
  snapshot: Record<string, unknown>;
}

const ENTITY_LABELS: Record<string, string> = {
  opportunities: 'Partner',
  contacts: 'Person',
  metros: 'Metro',
  events: 'Event',
  grants: 'Grant',
  volunteers: 'Volunteer',
};

export function useRecycleBin(options?: { limit?: number }) {
  const limit = options?.limit ?? 50;

  return useQuery({
    queryKey: ['recycle-bin', limit],
    queryFn: async () => {
      // Tenant view: use the safe tenant view that JOINs payloads (RLS-gated)
      const { data, error } = await supabase
        .from('recycle_bin_tenant_v' as any)
        .select('*')
        .is('restored_at', null)
        .is('purged_at', null)
        .order('deleted_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as RecycleBinEntry[];
    },
  });
}

export function useRestoreFromRecycleBin() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  const { emitRestorationSignal } = useEmitRestorationSignal();

  return useMutation({
    mutationFn: async (recycleId: string) => {
      const { data, error } = await supabase.rpc('restore_from_recycle_bin', {
        p_recycle_id: recycleId,
      });
      if (error) throw error;
      return data as { ok: boolean; entity_type: string; entity_id: string; entity_name: string };
    },
    onSuccess: (result) => {
      const label = ENTITY_LABELS[result.entity_type] || result.entity_type;
      toast.success(`Restored ${label}: ${result.entity_name || 'item'}`);

      // Invalidate only relevant queries
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      queryClient.invalidateQueries({ queryKey: [result.entity_type] });
      queryClient.invalidateQueries({ queryKey: ['restoration-signals'] });

      logAudit.mutate({
        action: 'restore',
        entityType: result.entity_type as any,
        entityId: result.entity_id,
        entityName: result.entity_name,
      });

      // Emit calm restoration narrative signal
      emitRestorationSignal({
        entityType: result.entity_type,
        sourceEventId: result.entity_id,
      });

      // Log action breadcrumb
      logActionEvent({
        event_type: 'entity_restored',
        entity_type: result.entity_type,
        entity_id: result.entity_id,
        metadata: { source: 'ui', surface: 'recycle_bin' },
      });
    },
    onError: (error) => {
      toast.error(`Restore failed: ${error.message}`);
    },
  });
}

export function useSoftDelete() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
    }: {
      entityType: string;
      entityId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from(entityType as 'opportunities')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        } as any)
        .eq('id', entityId);

      if (error) throw error;
      return { entityType, entityId };
    },
    onSuccess: ({ entityType, entityId }) => {
      queryClient.invalidateQueries({ queryKey: [entityType] });
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });

      logAudit.mutate({
        action: 'delete',
        entityType: entityType as any,
        entityId,
      });
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
}

export function getEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] || entityType;
}
