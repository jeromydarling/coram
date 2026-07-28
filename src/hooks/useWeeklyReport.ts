import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

export interface WeeklyReportJson {
  headline: string;
  executive_summary: string;
  key_wins: string[];
  relationship_growth: string[];
  journey_movement?: string[];
  outreach_report?: string[];
  provisions_delivered?: string[];
  engagement_signals?: string[];
  upcoming_focus: string[];
  risks_or_concerns: (string | null)[];
  calendar_preview: string[];
  // Legacy fields (backward compat)
  new_opportunities?: string[];
  outreach_performance?: string[];
  pipeline_momentum?: string[];
  risks_or_blockers?: (string | null)[];
  _metrics?: Record<string, unknown>;
  _generated_at?: string;
  _archetype?: string;
  _tenant_name?: string;
  _lookback_days?: number;
}

export interface WeeklyReport {
  id: string;
  user_id: string;
  week_of_date: string;
  report_json: WeeklyReportJson;
  created_at: string;
}

export interface BriefSchedule {
  brief_report_day: number; // 0=Sun..6=Sat
  brief_lookback_days: number;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export { DAY_LABELS };

export function useLatestWeeklyReport() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-report-latest', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('week_of_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        user_id: data.user_id,
        week_of_date: data.week_of_date,
        report_json: data.report_json as unknown as WeeklyReportJson,
        created_at: data.created_at,
      } as WeeklyReport;
    },
    enabled: !!user?.id,
  });
}

export function useGenerateWeeklyReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-weekly-report', {
        body: { user_id: user?.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-report-latest'] });
      toast.success('Leadership brief generated');
    },
    onError: (err) => {
      console.error('Failed to generate weekly report:', err);
      toast.error('Failed to generate leadership brief');
    },
  });
}

export function useUpdateWeeklyReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, report_json }: { id: string; report_json: WeeklyReportJson }) => {
      const { error } = await supabase
        .from('weekly_reports')
        .update({ report_json: report_json as any })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-report-latest'] });
      toast.success('Brief saved');
    },
    onError: (err) => {
      console.error('Failed to save weekly report:', err);
      toast.error('Failed to save brief');
    },
  });
}

export function useBriefSchedule() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['brief-schedule', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return { brief_report_day: 1, brief_lookback_days: 7 } as BriefSchedule;

      const { data, error } = await supabase
        .from('tenants')
        .select('brief_report_day, brief_lookback_days')
        .eq('id', tenant.id)
        .maybeSingle();

      if (error) throw error;
      return {
        brief_report_day: (data as any)?.brief_report_day ?? 1,
        brief_lookback_days: (data as any)?.brief_lookback_days ?? 7,
      } as BriefSchedule;
    },
    enabled: !!tenant?.id,
  });
}

export function useUpdateBriefSchedule() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();

  return useMutation({
    mutationFn: async (schedule: Partial<BriefSchedule>) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenants')
        .update(schedule as any)
        .eq('id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brief-schedule'] });
      toast.success('Brief schedule updated');
    },
    onError: (err) => {
      console.error('Failed to update brief schedule:', err);
      toast.error('Failed to save schedule');
    },
  });
}
