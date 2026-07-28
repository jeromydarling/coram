import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type AuditAction = 'create' | 'update' | 'delete' | 'import' | 'bulk_update' | 'bulk_delete' | 'restore' | 'duplicate';
export type AuditEntityType = 'opportunity' | 'contact' | 'event' | 'anchor' | 'anchor_pipeline' | 'activity' | 'metro' | 'region' | 'grant' | 'grant_anchor_link';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  created_at: string;
  user_name?: string;
}

interface LogAuditParams {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

export function useAuditLog(filters?: { entityType?: string; userId?: string }) {
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      const { data: logs, error: logsError } = await query;

      if (logsError) throw logsError;

      // Fetch user names for the logs (use public view to avoid exposing tokens)
      const userIds = [...new Set(logs.map(log => log.user_id))];
      
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const userNameMap = new Map(
        profiles?.map(p => [p.user_id, p.display_name]) || []
      );

      return logs.map(log => ({
        ...log,
        user_name: userNameMap.get(log.user_id) || 'Unknown User'
      })) as AuditLogEntry[];
    }
  });
}

export function useLogAudit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, entityType, entityId, entityName, changes }: LogAuditParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('Cannot log audit: No authenticated user');
        return null;
      }

      // Use the secure RPC function to insert audit logs
      // This prevents users from being able to flood or manipulate the audit log
      const { data, error } = await supabase
        .rpc('log_audit_entry', {
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_action: action,
          p_entity_name: entityName || null,
          p_changes: (changes || null) as Json
        });

      if (error) {
        console.error('Failed to log audit:', error);
        // Don't throw - audit logging should not block operations
        return null;
      }

      return { id: data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    }
  });
}

// Helper to compute changes between old and new objects
export function computeChanges<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: Partial<T>,
  fieldsToTrack?: (keyof T)[]
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  
  const keysToCheck = fieldsToTrack || Object.keys(newObj) as (keyof T)[];
  
  for (const key of keysToCheck) {
    if (key in newObj && oldObj[key] !== newObj[key]) {
      changes[key as string] = {
        old: oldObj[key],
        new: newObj[key]
      };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}
