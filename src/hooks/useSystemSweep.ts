import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

// ── Types ──
export interface SystemJob {
  id: string;
  key: string;
  name: string;
  description: string;
  owner: string;
  schedule: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemJobRun {
  id: string;
  job_key: string;
  scope: string;
  metro_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  stats: Record<string, unknown>;
  outputs: Record<string, unknown>;
  errors: Array<Record<string, unknown>>;
}

export interface SystemSuggestion {
  id: string;
  created_at: string;
  scope: string;
  metro_id: string | null;
  opportunity_id: string | null;
  suggestion_type: string;
  title: string;
  summary: string;
  rationale: Record<string, unknown>;
  confidence: number;
  source_refs: Array<Record<string, unknown>>;
  delivered_at: string | null;
  dismissed_at: string | null;
  acted_at: string | null;
  action_taken: string | null;
  dedupe_key: string | null;
}

export interface MetroHealthRow {
  metro_id: string;
  metro_name: string;
  news_status: string;
  events_status: string;
  narrative_status: string;
  drift_status: string;
  suggestions_created: number;
}

export interface SweepHeartbeat {
  lastSweepRun: SystemJobRun | null;
  metrosProcessed: number;
  suggestionsThisWeek: number;
  quietMetros: number;
  staleMetros: number;
  metroHealth: MetroHealthRow[];
}

// ── Hooks ──

/** Fetch system_jobs list */
export function useSystemJobs() {
  return useQuery({
    queryKey: ['system-jobs'],
    queryFn: async (): Promise<SystemJob[]> => {
      const { data, error } = await supabase
        .from('system_jobs')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as SystemJob[];
    },
    staleTime: 60_000,
  });
}

/** Fetch latest system-scope sweep run and extract heartbeat */
export function useSweepHeartbeat() {
  return useQuery({
    queryKey: ['sweep-heartbeat'],
    queryFn: async (): Promise<SweepHeartbeat> => {
      // Last system-level sweep run
      const { data: lastRun } = await supabase
        .from('system_job_runs')
        .select('*')
        .eq('job_key', 'system_sweep')
        .eq('scope', 'system')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const run = lastRun as unknown as SystemJobRun | null;
      const stats = (run?.stats ?? {}) as Record<string, number>;
      const outputs = (run?.outputs ?? {}) as Record<string, unknown>;
      const metroResults = (outputs.metro_results ?? []) as MetroHealthRow[];

      // Count suggestions created this week
      const weekStart = getWeekStartISO();
      const { count } = await supabase
        .from('system_suggestions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStart);

      return {
        lastSweepRun: run,
        metrosProcessed: stats.metros_processed ?? 0,
        suggestionsThisWeek: count ?? 0,
        quietMetros: stats.quiet_metros ?? 0,
        staleMetros: stats.stale_metros ?? 0,
        metroHealth: metroResults,
      };
    },
    staleTime: 60_000,
  });
}

/** Fetch recent job runs across all jobs */
export function useRecentJobRuns(jobKey?: string, limit = 20) {
  return useQuery({
    queryKey: ['system-job-runs', jobKey, limit],
    queryFn: async (): Promise<SystemJobRun[]> => {
      let query = supabase
        .from('system_job_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);
      if (jobKey) query = query.eq('job_key', jobKey);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SystemJobRun[];
    },
    staleTime: 30_000,
  });
}

/** Fetch suggestion ledger */
export function useSystemSuggestions(filters?: {
  metroId?: string;
  type?: string;
  limit?: number;
}) {
  const metroId = filters?.metroId;
  const type = filters?.type;
  const limit = filters?.limit ?? 50;

  return useQuery({
    queryKey: ['system-suggestions', metroId, type, limit],
    queryFn: async (): Promise<SystemSuggestion[]> => {
      let query = supabase
        .from('system_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (metroId) query = query.eq('metro_id', metroId);
      if (type) query = query.eq('suggestion_type', type);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SystemSuggestion[];
    },
    staleTime: 30_000,
  });
}

/** Trigger manual sweep */
export function useTriggerSweep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-sweep', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sweep-heartbeat'] });
      queryClient.invalidateQueries({ queryKey: ['system-job-runs'] });
      queryClient.invalidateQueries({ queryKey: ['system-suggestions'] });
      toast.success(`Sweep complete — ${data?.metros_processed ?? 0} metros processed`);
    },
    onError: (err) => toast.error(`Sweep failed: ${err.message}`),
  });
}

/** Dismiss a suggestion */
export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('system_suggestions')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-suggestions'] });
    },
  });
}

function getWeekStartISO(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
  return monday.toISOString();
}
