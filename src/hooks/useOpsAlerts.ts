import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OpsAlert {
  id: string;
  type: 'high_usage' | 'retry_spike' | 'cap_hit' | 'stuck_runs' | 'repeated_failure';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  org_id?: string | null;
  workflow_key?: string | null;
  created_at: string;
}

// Thresholds (configurable via constants)
const HIGH_USAGE_THRESHOLD = 30; // events/day considered high
const RETRY_SPIKE_THRESHOLD = 5; // retries/day considered spike
const STUCK_THRESHOLD_MINUTES = 10;

/**
 * Ops feed: generates alerts from automation_runs data.
 * Rule-based anomaly detection — no AI, pure deterministic.
 */
export function useOpsAlerts(windowHours: number = 24) {
  return useQuery<OpsAlert[]>({
    queryKey: ['ops-alerts', windowHours],
    queryFn: async () => {
      const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
      const alerts: OpsAlert[] = [];

      // Fetch runs in window
      const { data: runs, error } = await supabase
        .from('automation_runs')
        .select('run_id, workflow_key, status, created_at, processed_at, org_id, org_name, parent_run_id, error_message')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!runs?.length) return [];

      // 1. Stuck runs detection
      const now = Date.now();
      const stuckRuns = runs.filter(r =>
        (r.status === 'dispatched' || r.status === 'running') &&
        (now - new Date(r.created_at).getTime()) > STUCK_THRESHOLD_MINUTES * 60 * 1000
      );
      if (stuckRuns.length > 0) {
        alerts.push({
          id: `stuck-${windowHours}`,
          type: 'stuck_runs',
          severity: stuckRuns.length > 3 ? 'critical' : 'warning',
          title: `${stuckRuns.length} stuck run(s)`,
          detail: `Runs in dispatched/running for >${STUCK_THRESHOLD_MINUTES}min: ${stuckRuns.map(r => r.run_id.slice(0, 8)).join(', ')}`,
          created_at: new Date().toISOString(),
        });
      }

      // 2. Cap hit detection
      const capHits = runs.filter(r => r.status === 'skipped_due_to_cap');
      if (capHits.length > 0) {
        alerts.push({
          id: `cap-${windowHours}`,
          type: 'cap_hit',
          severity: capHits.length > 5 ? 'critical' : 'warning',
          title: `${capHits.length} cap violation(s)`,
          detail: `Workflows skipped due to caps: ${[...new Set(capHits.map(r => r.workflow_key))].join(', ')}`,
          created_at: new Date().toISOString(),
        });
      }

      // 3. Retry spike detection
      const retries = runs.filter(r => r.parent_run_id);
      if (retries.length >= RETRY_SPIKE_THRESHOLD) {
        alerts.push({
          id: `retry-spike-${windowHours}`,
          type: 'retry_spike',
          severity: retries.length > 10 ? 'critical' : 'warning',
          title: `Retry spike: ${retries.length} retries`,
          detail: `Unusual retry activity detected in the last ${windowHours}h`,
          created_at: new Date().toISOString(),
        });
      }

      // 4. High usage per org
      const orgCounts = new Map<string, { count: number; name: string | null }>();
      for (const r of runs) {
        if (!r.org_id) continue;
        const existing = orgCounts.get(r.org_id);
        if (existing) {
          existing.count++;
        } else {
          orgCounts.set(r.org_id, { count: 1, name: r.org_name });
        }
      }
      for (const [orgId, { count, name }] of orgCounts) {
        if (count >= HIGH_USAGE_THRESHOLD) {
          alerts.push({
            id: `high-usage-${orgId}`,
            type: 'high_usage',
            severity: count > HIGH_USAGE_THRESHOLD * 2 ? 'critical' : 'info',
            title: `High usage: ${name || orgId.slice(0, 8)}`,
            detail: `${count} runs in the last ${windowHours}h`,
            org_id: orgId,
            created_at: new Date().toISOString(),
          });
        }
      }

      // 5. Repeated failure per workflow
      const failsByWorkflow = new Map<string, number>();
      for (const r of runs) {
        if (r.status === 'error' || r.status === 'failed_timeout') {
          failsByWorkflow.set(r.workflow_key, (failsByWorkflow.get(r.workflow_key) ?? 0) + 1);
        }
      }
      for (const [wk, count] of failsByWorkflow) {
        if (count >= 3) {
          alerts.push({
            id: `repeated-fail-${wk}`,
            type: 'repeated_failure',
            severity: count >= 5 ? 'critical' : 'warning',
            title: `Repeated failures: ${wk}`,
            detail: `${count} failures in the last ${windowHours}h`,
            workflow_key: wk,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Ops digest: summary stats for the last 24h.
 */
export function useOpsDigest() {
  return useQuery({
    queryKey: ['ops-digest'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: runs, error } = await supabase
        .from('automation_runs')
        .select('workflow_key, status, org_id, org_name')
        .gte('created_at', since);
      if (error) throw error;

      const totalRuns = runs?.length ?? 0;
      const failures = runs?.filter(r => r.status === 'error' || r.status === 'failed_timeout').length ?? 0;
      const capHits = runs?.filter(r => r.status === 'skipped_due_to_cap').length ?? 0;
      const processed = runs?.filter(r => r.status === 'processed').length ?? 0;

      // Top orgs by run count
      const orgMap = new Map<string, { name: string | null; count: number }>();
      for (const r of runs ?? []) {
        if (!r.org_id) continue;
        const e = orgMap.get(r.org_id);
        if (e) e.count++;
        else orgMap.set(r.org_id, { name: r.org_name, count: 1 });
      }
      const topOrgs = Array.from(orgMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id, v]) => ({ org_id: id, org_name: v.name, count: v.count }));

      // Failures by workflow
      const failsByWf = new Map<string, number>();
      for (const r of runs ?? []) {
        if (r.status === 'error' || r.status === 'failed_timeout') {
          failsByWf.set(r.workflow_key, (failsByWf.get(r.workflow_key) ?? 0) + 1);
        }
      }

      return {
        totalRuns,
        failures,
        capHits,
        processed,
        successRate: totalRuns > 0 ? Math.round((processed / totalRuns) * 100) : 100,
        topOrgs,
        failuresByWorkflow: Object.fromEntries(failsByWf),
      };
    },
    staleTime: 120_000,
  });
}
