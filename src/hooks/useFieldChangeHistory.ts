/**
 * useFieldChangeHistory — Fetches field-level diffs from the audit log.
 *
 * WHAT: Queries audit_log for entries with changes JSON for a specific entity.
 * WHERE: Used in entity detail panels to show change history.
 * WHY: Users need to see who changed what and when for accountability.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FieldChange {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  changes: Record<string, { from?: unknown; to?: unknown }> | null;
  created_at: string;
}

export function useFieldChangeHistory(entityType: string, entityId: string | undefined, enabled = true) {
  return useQuery<FieldChange[]>({
    queryKey: ['field-change-history', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, user_id, action, entity_type, entity_name, changes, created_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId!)
        .not('changes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as FieldChange[];
    },
    enabled: enabled && !!entityId,
  });
}
