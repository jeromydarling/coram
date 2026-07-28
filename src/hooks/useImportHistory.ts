import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface ImportHistoryEntry {
  id: string;
  import_type: 'contacts' | 'events' | 'grants';
  file_name: string | null;
  total_rows: number;
  created_count: number;
  updated_count: number;
  imported_by: string | null;
  imported_at: string;
  is_rolled_back: boolean;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
  user_name?: string;
}

export interface ImportRecord {
  id: string;
  import_id: string;
  entity_type: string;
  entity_id: string;
  operation: 'created' | 'updated';
  previous_data: Record<string, unknown> | null;
  created_at: string;
}

// Fetch import history
export function useImportHistory(importType?: string) {
  return useQuery({
    queryKey: ['import-history', importType],
    queryFn: async () => {
      let query = supabase
        .from('csv_import_history')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(50);

      if (importType && importType !== 'all') {
        query = query.eq('import_type', importType);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user names for display
      const userIds = [...new Set(data?.map(d => d.imported_by).filter(Boolean) || [])];
      let userMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        
        if (profiles) {
          profiles.forEach(p => {
            if (p.user_id) userMap[p.user_id] = p.display_name || 'Unknown User';
          });
        }
      }

      return (data || []).map(entry => ({
        ...entry,
        user_name: entry.imported_by ? (userMap[entry.imported_by] || 'Unknown User') : 'System'
      })) as ImportHistoryEntry[];
    }
  });
}

// Fetch records for a specific import
export function useImportRecords(importId: string | null) {
  return useQuery({
    queryKey: ['import-records', importId],
    queryFn: async () => {
      if (!importId) return [];
      
      const { data, error } = await supabase
        .from('csv_import_records')
        .select('*')
        .eq('import_id', importId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ImportRecord[];
    },
    enabled: !!importId
  });
}

// Create import history entry
export function useCreateImportHistory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      import_type: 'contacts' | 'events' | 'grants';
      file_name?: string;
      total_rows: number;
      created_count: number;
      updated_count: number;
    }) => {
      const { data: result, error } = await supabase
        .from('csv_import_history')
        .insert({
          ...data,
          imported_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    }
  });
}

// Add records to an import
export function useAddImportRecords() {
  return useMutation({
    mutationFn: async (records: {
      import_id: string;
      entity_type: string;
      entity_id: string;
      operation: 'created' | 'updated';
      previous_data?: Record<string, unknown> | null;
    }[]) => {
      if (records.length === 0) return [];
      
      // Convert to the expected database format
      const dbRecords = records.map(r => ({
        import_id: r.import_id,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        operation: r.operation,
        previous_data: r.previous_data ? JSON.parse(JSON.stringify(r.previous_data)) : null
      }));
      
      const { data, error } = await supabase
        .from('csv_import_records')
        .insert(dbRecords)
        .select();

      if (error) throw error;
      return data;
    }
  });
}

// Rollback an import
export function useRollbackImport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (importId: string) => {
      // First, fetch the import details
      const { data: importEntry, error: fetchError } = await supabase
        .from('csv_import_history')
        .select('*')
        .eq('id', importId)
        .single();

      if (fetchError) throw fetchError;
      if (!importEntry) throw new Error('Import not found');
      if (importEntry.is_rolled_back) throw new Error('Import has already been rolled back');

      // Fetch all records for this import
      const { data: records, error: recordsError } = await supabase
        .from('csv_import_records')
        .select('*')
        .eq('import_id', importId);

      if (recordsError) throw recordsError;

      const results = {
        deleted: 0,
        restored: 0,
        failed: 0
      };

      // Process each record
      for (const record of records || []) {
        try {
          if (record.operation === 'created') {
            // Delete created records based on entity type
            const entityType = record.entity_type.toLowerCase();
            let error = null;
            
            if (entityType === 'contact' || entityType === 'contacts') {
              const result = await supabase.from('contacts').delete().eq('id', record.entity_id);
              error = result.error;
            } else if (entityType === 'event' || entityType === 'events') {
              const result = await supabase.from('events').delete().eq('id', record.entity_id);
              error = result.error;
            } else if (entityType === 'grant' || entityType === 'grants') {
              const result = await supabase.from('grants').delete().eq('id', record.entity_id);
              error = result.error;
            } else if (entityType === 'opportunity' || entityType === 'opportunities') {
              const result = await supabase.from('opportunities').delete().eq('id', record.entity_id);
              error = result.error;
            }
            
            if (!error) {
              results.deleted++;
            } else {
              console.warn(`Failed to delete ${record.entity_type} ${record.entity_id}:`, error.message);
              results.failed++;
            }
          } else if (record.operation === 'updated' && record.previous_data) {
            // Restore previous data for updated records
            const entityType = record.entity_type.toLowerCase();
            const previousData = record.previous_data as Record<string, unknown>;
            let error = null;
            
            if (entityType === 'contact' || entityType === 'contacts') {
              const result = await supabase.from('contacts').update(previousData).eq('id', record.entity_id);
              error = result.error;
            } else if (entityType === 'event' || entityType === 'events') {
              const result = await supabase.from('events').update(previousData).eq('id', record.entity_id);
              error = result.error;
            } else if (entityType === 'grant' || entityType === 'grants') {
              const result = await supabase.from('grants').update(previousData).eq('id', record.entity_id);
              error = result.error;
            } else if (entityType === 'opportunity' || entityType === 'opportunities') {
              const result = await supabase.from('opportunities').update(previousData).eq('id', record.entity_id);
              error = result.error;
            }
            
            if (!error) {
              results.restored++;
            } else {
              console.warn(`Failed to restore ${record.entity_type} ${record.entity_id}:`, error.message);
              results.failed++;
            }
          }
        } catch (e) {
          console.error(`Error processing record ${record.id}:`, e);
          results.failed++;
        }
      }

      // Mark import as rolled back
      const { error: updateError } = await supabase
        .from('csv_import_history')
        .update({
          is_rolled_back: true,
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: user?.id
        })
        .eq('id', importId);

      if (updateError) throw updateError;

      return results;
    },
    onSuccess: (results, importId) => {
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
      queryClient.invalidateQueries({ queryKey: ['import-runs'] });
      queryClient.invalidateQueries({ queryKey: ['import-records', importId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });

      const messages = [];
      if (results.deleted > 0) messages.push(`${results.deleted} records deleted`);
      if (results.restored > 0) messages.push(`${results.restored} records restored`);
      if (results.failed > 0) messages.push(`${results.failed} failed`);

      toast.success(`Rollback complete: ${messages.join(', ')}`);
    },
    onError: (error) => {
      toast.error(`Rollback failed: ${error.message}`);
    }
  });
}

