import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AutomationRun } from '@/hooks/useAutomationHealth';

/**
 * Fetch recent automation runs for a specific workflow key.
 * Shows run_id, status, created_at, error, and key outputs.
 */
export function useWorkflowResults(workflowKey: string, limit: number = 20) {
  return useQuery<AutomationRun[]>({
    queryKey: ['workflow-results', workflowKey, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_runs')
        .select('run_id, workflow_key, status, created_at, processed_at, error_message, triggered_by')
        .eq('workflow_key', workflowKey)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AutomationRun[];
    },
    staleTime: 30_000,
  });
}
