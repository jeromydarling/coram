import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TrackedRecord {
  entity_type: string;
  entity_id: string;
  operation: 'created' | 'updated';
  previous_data?: Record<string, unknown> | null;
}

export interface TrackImportParams {
  import_type: 'contacts' | 'events' | 'grants';
  file_name?: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  records: TrackedRecord[];
}

/**
 * Hook to track import operations for rollback capability
 * Call this after a successful import to record the history
 */
export function useTrackImport() {
  const { user } = useAuth();

  const trackImport = async (params: TrackImportParams) => {
    if (!user?.id) {
      console.warn('No user logged in, skipping import tracking');
      return null;
    }

    try {
      // Create the import history entry
      const { data: importEntry, error: historyError } = await supabase
        .from('csv_import_history')
        .insert({
          import_type: params.import_type,
          file_name: params.file_name || null,
          total_rows: params.total_rows,
          created_count: params.created_count,
          updated_count: params.updated_count,
          imported_by: user.id
        })
        .select()
        .single();

      if (historyError) {
        console.error('Failed to create import history entry:', historyError);
        return null;
      }

      // Add the import records if we have them
      if (params.records.length > 0 && importEntry) {
        const recordsToInsert = params.records.map(record => ({
          import_id: importEntry.id,
          entity_type: record.entity_type,
          entity_id: record.entity_id,
          operation: record.operation,
          previous_data: record.previous_data 
            ? JSON.parse(JSON.stringify(record.previous_data)) 
            : null
        }));

        const { error: recordsError } = await supabase
          .from('csv_import_records')
          .insert(recordsToInsert);

        if (recordsError) {
          console.error('Failed to create import records:', recordsError);
        }
      }

      return importEntry;
    } catch (error) {
      console.error('Error tracking import:', error);
      return null;
    }
  };

  return { trackImport };
}
