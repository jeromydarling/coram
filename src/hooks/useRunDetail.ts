import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Extended run detail with full row data for the detail drawer. */
export interface AutomationRunDetail {
  id: string;
  run_id: string;
  workflow_key: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  received_at: string;
  error_message: string | null;
  triggered_by: string | null;
  org_id: string | null;
  org_name: string | null;
  metro_id: string | null;
  parent_run_id: string | null;
  inputs_hash: string | null;
  payload_fingerprint: string | null;
  dispatch_payload: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  scope_json: Record<string, unknown> | null;
}

/** Linked usage event for a run */
export interface LinkedUsageEvent {
  id: string;
  event_type: string;
  quantity: number;
  unit: string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
}

const NON_BILLABLE_STATUSES = new Set([
  'deduped', 'skipped_due_to_cap', 'error', 'failed_timeout', 'throttled', 'rate_limited',
]);

/** Whether a run status is considered billable */
export function isBillableStatus(status: string): boolean {
  return !NON_BILLABLE_STATUSES.has(status);
}

/** Human label for billable state */
export function billableLabel(status: string): string {
  if (status === 'processed') return 'Billable';
  if (status === 'deduped') return 'Not billable (deduped)';
  if (status === 'skipped_due_to_cap') return 'Not billable (cap hit)';
  if (status === 'error' || status === 'failed_timeout') return 'Not billable (failed)';
  if (status === 'throttled' || status === 'rate_limited') return 'Not billable (throttled)';
  if (status === 'running' || status === 'dispatched') return 'Pending';
  return 'Unknown';
}

/**
 * Fetch full run detail including linked usage events.
 */
export function useRunDetail(runId: string | null) {
  return useQuery({
    queryKey: ['run-detail', runId],
    queryFn: async () => {
      if (!runId) return null;
      
      const [runResult, usageResult] = await Promise.all([
        supabase
          .from('automation_runs')
          .select('*')
          .eq('run_id', runId)
          .maybeSingle(),
        supabase
          .from('usage_events')
          .select('id, event_type, quantity, unit, occurred_at, metadata')
          .eq('run_id', runId)
          .order('occurred_at', { ascending: true }),
      ]);

      if (runResult.error) throw runResult.error;

      return {
        run: runResult.data as AutomationRunDetail | null,
        usageEvents: (usageResult.data ?? []) as LinkedUsageEvent[],
      };
    },
    enabled: !!runId,
    staleTime: 15_000,
  });
}

export interface FilteredRunsParams {
  workflowKey: string | null;
  status: string | null;
  orgId: string | null;
  windowHours: number;
}

/**
 * Fetch automation runs with multi-filter support.
 */
export function useFilteredRuns({ workflowKey, status, orgId, windowHours }: FilteredRunsParams) {
  return useQuery<AutomationRunDetail[]>({
    queryKey: ['filtered-runs', workflowKey, status, orgId, windowHours],
    queryFn: async () => {
      const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
      let query = supabase
        .from('automation_runs')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);

      if (workflowKey) query = query.eq('workflow_key', workflowKey);
      if (status) query = query.eq('status', status);
      if (orgId) query = query.eq('org_id', orgId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AutomationRunDetail[];
    },
    refetchInterval: 30_000,
  });
}
