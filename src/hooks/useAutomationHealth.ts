import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface AutomationRun {
  run_id: string;
  workflow_key: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
  triggered_by: string | null;
}

export interface WorkflowCounts {
  workflow_key: string;
  total: number;
  processed: number;
  error: number;
  running: number;
  dispatched: number;
}

export interface WorkflowErrorRate {
  workflow_key: string;
  error_rate: number | null;
}

export interface WorkflowDuration {
  workflow_key: string;
  avg_duration_seconds: number | null;
}

export interface AutomationHealthData {
  window_hours: number;
  counts_by_workflow: WorkflowCounts[];
  error_rate_by_workflow: WorkflowErrorRate[];
  avg_duration_seconds_by_workflow: WorkflowDuration[];
  latest_by_workflow: AutomationRun[];
  stuck_runs: AutomationRun[];
  recent_runs: AutomationRun[];
  recent_errors: AutomationRun[];
}

export function useAutomationHealth(workflowKey: string | null, windowHours: number) {
  return useQuery<AutomationHealthData>({
    queryKey: ['automation-health', workflowKey, windowHours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_automation_health', {
        p_workflow_key: workflowKey,
        p_window_hours: windowHours,
      });
      if (error) throw error;
      return data as unknown as AutomationHealthData;
    },
    refetchInterval: 30_000,
  });
}

export function useRetryRun() {
  const queryClient = useQueryClient();
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  const retryRun = async (runId: string, mode: 'retry' | 'force_crawl' = 'retry') => {
    setRetryingRunId(runId);
    try {
      const { data, error } = await supabase.functions.invoke('automation-retry', {
        body: { run_id: runId, mode },
      });

      if (error) {
        toast.error(`Retry failed: ${error.message}`);
        return;
      }

      const result = data as { ok: boolean; new_run_id?: string; error?: string; message?: string };
      if (result?.ok && result.new_run_id) {
        toast.success(`Retry dispatched — new run: ${result.new_run_id.slice(0, 8)}…`);
        queryClient.invalidateQueries({ queryKey: ['automation-health'] });
      } else {
        toast.error(`Retry failed: ${result?.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(`Retry error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setRetryingRunId(null);
    }
  };

  return { retryRun, retryingRunId };
}
