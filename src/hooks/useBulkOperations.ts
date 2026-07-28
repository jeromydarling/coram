/**
 * useBulkOperations — Hook for multi-select edit/delete operations.
 *
 * WHAT: Manages selection state and provides bulk action methods.
 * WHERE: Used in contacts, opportunities, and activities list pages.
 * WHY: Enterprise CRMs need batch operations to manage large datasets efficiently.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useBulkOperations(entityType: string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const bulkDelete = useMutation({
    mutationFn: async () => {
      if (!user?.id || !tenantId) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('bulk_soft_delete' as any, {
        p_table: entityType,
        p_ids: Array.from(selectedIds),
        p_user_id: user.id,
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) throw new Error(result?.error ?? 'Bulk delete failed');
      return result;
    },
    onSuccess: (data) => {
      toast.success(`${data.affected} item${data.affected !== 1 ? 's' : ''} moved to recycle bin.`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: [entityType] });
    },
    onError: (err: Error) => {
      toast.error(`Bulk delete failed: ${err.message}`);
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      if (!user?.id || !tenantId) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('bulk_update_field' as any, {
        p_table: entityType,
        p_ids: Array.from(selectedIds),
        p_field: field,
        p_value: value,
        p_user_id: user.id,
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) throw new Error(result?.error ?? 'Bulk update failed');
      return result;
    },
    onSuccess: (data) => {
      toast.success(`${data.affected} item${data.affected !== 1 ? 's' : ''} updated.`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: [entityType] });
    },
    onError: (err: Error) => {
      toast.error(`Bulk update failed: ${err.message}`);
    },
  });

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleId,
    selectAll,
    clearSelection,
    isSelected,
    bulkDelete,
    bulkUpdate,
  };
}
