import { useCallback, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';

type EntityType = 'contact' | 'opportunity' | 'grant';

interface DeletedRecord {
  id: string;
  data: Record<string, unknown>;
  entityType: EntityType;
  entityName?: string;
}

interface UndoState {
  records: DeletedRecord[];
  timeoutId: NodeJS.Timeout | null;
  toastId: string | number | undefined;
}

const UNDO_TIMEOUT_MS = 8000; // 8 seconds to undo

const getTableName = (entityType: EntityType): string => {
  switch (entityType) {
    case 'contact': return 'contacts';
    case 'opportunity': return 'opportunities';
    case 'grant': return 'grants';
  }
};

const getNameField = (entityType: EntityType): string => {
  switch (entityType) {
    case 'contact': return 'name';
    case 'opportunity': return 'organization';
    case 'grant': return 'grant_name';
  }
};

const getQueryKeys = (entityType: EntityType): string[][] => {
  switch (entityType) {
    case 'contact': return [['contacts'], ['opportunities']];
    case 'opportunity': return [['opportunities'], ['contacts'], ['anchor_pipeline']];
    case 'grant': return [['grants'], ['grant-kpis']];
  }
};

export function useDeleteWithUndo() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  const undoStateRef = useRef<UndoState>({
    records: [],
    timeoutId: null,
    toastId: undefined,
  });

  const restoreRecords = useCallback(async (records: DeletedRecord[]) => {
    const byType = records.reduce((acc, record) => {
      if (!acc[record.entityType]) acc[record.entityType] = [];
      acc[record.entityType].push(record);
      return acc;
    }, {} as Record<EntityType, DeletedRecord[]>);

    for (const [entityType, typeRecords] of Object.entries(byType)) {
      const tableName = getTableName(entityType as EntityType);
      
      for (const record of typeRecords) {
        // Re-insert the record
        const { error } = await (supabase
          .from(tableName as 'contacts')
          .insert(record.data as never));
        
        if (error) {
          console.error(`Failed to restore ${entityType}:`, error);
          throw error;
        }

        // Log the restore action
        logAudit.mutate({
          action: 'restore',
          entityType: entityType as EntityType,
          entityId: record.id,
          entityName: record.entityName,
        });
      }

      // Invalidate queries for this type
      const queryKeys = getQueryKeys(entityType as EntityType);
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [queryClient, logAudit]);

  const handleUndo = useCallback(async () => {
    const state = undoStateRef.current;
    
    // Clear timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
    
    // Dismiss current toast
    if (state.toastId) {
      toast.dismiss(state.toastId);
    }

    if (state.records.length === 0) return;

    try {
      await restoreRecords(state.records);
      const count = state.records.length;
      const entityType = state.records[0].entityType;
      toast.success(`Restored ${count} ${entityType}${count > 1 ? 's' : ''}`);
    } catch (error) {
      toast.error('Failed to restore records');
      console.error('Restore error:', error);
    } finally {
      state.records = [];
    }
  }, [restoreRecords]);

  const executeDelete = useMutation({
    mutationFn: async ({ 
      ids, 
      entityType 
    }: { 
      ids: string[]; 
      entityType: EntityType;
    }) => {
      const tableName = getTableName(entityType);
      const nameField = getNameField(entityType);

      // Fetch records before deleting
      const { data: records, error: fetchError } = await supabase
        .from(tableName as 'contacts')
        .select('*')
        .in('id', ids);
      
      if (fetchError) throw fetchError;
      if (!records || records.length === 0) {
        throw new Error('Records not found');
      }

      // Store for potential undo
      const deletedRecords: DeletedRecord[] = records.map((record: Record<string, unknown>) => ({
        id: record.id as string,
        data: record,
        entityType,
        entityName: record[nameField] as string | undefined,
      }));

      // Perform delete
      const { error: deleteError } = await supabase
        .from(tableName as 'contacts')
        .delete()
        .in('id', ids);
      
      if (deleteError) throw deleteError;

      return { deletedRecords, entityType };
    },
    onSuccess: ({ deletedRecords, entityType }) => {
      // Clear any existing undo state
      const state = undoStateRef.current;
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      if (state.toastId) {
        toast.dismiss(state.toastId);
      }

      // Store deleted records for undo
      state.records = deletedRecords;

      // Invalidate queries
      const queryKeys = getQueryKeys(entityType);
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }

      // Log audit for each deletion
      for (const record of deletedRecords) {
        logAudit.mutate({
          action: 'delete',
          entityType,
          entityId: record.id,
          entityName: record.entityName,
        });
      }

      // Show toast with undo button
      const count = deletedRecords.length;
      const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      
      state.toastId = toast.success(
        `Deleted ${count} ${entityLabel.toLowerCase()}${count > 1 ? 's' : ''}`,
        {
          duration: UNDO_TIMEOUT_MS,
          action: {
            label: 'Undo',
            onClick: () => handleUndo(),
          },
        }
      );

      // Set timeout to clear undo state
      state.timeoutId = setTimeout(() => {
        state.records = [];
        state.timeoutId = null;
        state.toastId = undefined;
      }, UNDO_TIMEOUT_MS);
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const deleteRecords = useCallback(
    (ids: string[], entityType: EntityType) => {
      return executeDelete.mutateAsync({ ids, entityType });
    },
    [executeDelete]
  );

  const deleteRecord = useCallback(
    (id: string, entityType: EntityType) => {
      return deleteRecords([id], entityType);
    },
    [deleteRecords]
  );

  return {
    deleteRecord,
    deleteRecords,
    isDeleting: executeDelete.isPending,
  };
}
