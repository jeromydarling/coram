import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  sections: string[];
  filters: Record<string, unknown>;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  id: string;
  template_id: string | null;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  recipients: string[];
  region_id: string | null;
  metro_id: string | null;
  is_active: boolean;
  last_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Available report sections that can be included
export const REPORT_SECTIONS = [
  { id: 'kpi_overview', name: 'KPI Overview', description: 'Key metrics like anchors, opportunities, pipeline', type: 'kpi' },
  { id: 'forecast_kpis', name: 'Forecast KPIs', description: '30/60/90 day anchor forecasts', type: 'kpi' },
  { id: 'pipeline_stage', name: 'Pipeline by Stage', description: 'Table showing pipeline breakdown', type: 'table' },
  { id: 'pipeline_chart', name: 'Pipeline Chart', description: 'Visual chart of pipeline stages', type: 'chart' },
  { id: 'forecast_table', name: 'Forecast Table', description: 'Upcoming anchor conversions', type: 'table' },
  { id: 'recent_wins', name: 'Recent Wins', description: 'New anchors and successful events', type: 'highlight' },
  { id: 'top_opportunities', name: 'Active Opportunities', description: 'Top opportunities by stage', type: 'table' },
  { id: 'metro_breakdown', name: 'Metro Breakdown', description: 'Performance by metro area', type: 'table' },
  { id: 'anchor_trend', name: 'Anchor Trend Chart', description: '6-month anchor growth chart', type: 'chart' },
  { id: 'volume_chart', name: 'Volume Chart', description: 'Monthly volume trends', type: 'chart' },
  { id: 'grant_kpis', name: 'Grant KPIs', description: 'Grant pipeline and funding metrics', type: 'kpi' },
  { id: 'grants_by_stage', name: 'Grants by Stage', description: 'Grant distribution across pipeline stages', type: 'chart' },
  { id: 'grants_by_funder', name: 'Grants by Funder Type', description: 'Funding breakdown by funder category', type: 'chart' },
  { id: 'active_grants', name: 'Active Grants Table', description: 'List of currently active grants', type: 'table' },
] as const;

export type ReportSectionId = typeof REPORT_SECTIONS[number]['id'];

export function useReportTemplates() {
  return useQuery({
    queryKey: ['report-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
      
      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        sections: Array.isArray(t.sections) ? t.sections : JSON.parse(t.sections as string || '[]'),
        filters: typeof t.filters === 'object' ? t.filters : JSON.parse(t.filters as string || '{}'),
      })) as ReportTemplate[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('report_templates')
        .insert({
          ...template,
          sections: template.sections as unknown as string,
          filters: template.filters as unknown as string,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...template }: Partial<ReportTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('report_templates')
        .update({
          ...template,
          sections: template.sections as unknown as string,
          filters: template.filters as unknown as string,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('report_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

export function useReportSchedules() {
  return useQuery({
    queryKey: ['report-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*, report_templates(name)')
        .order('name');
      
      if (error) throw error;
      
      return (data || []).map(s => ({
        ...s,
        recipients: Array.isArray(s.recipients) ? s.recipients : JSON.parse(s.recipients as string || '[]'),
      })) as (ReportSchedule & { report_templates: { name: string } | null })[];
    },
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (schedule: Omit<ReportSchedule, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'last_sent_at'>) => {
      const { data, error } = await supabase
        .from('report_schedules')
        .insert({
          ...schedule,
          recipients: schedule.recipients as unknown as string,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Schedule created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create schedule: ${error.message}`);
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...schedule }: Partial<ReportSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from('report_schedules')
        .update({
          ...schedule,
          recipients: schedule.recipients as unknown as string,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Schedule updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('report_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Schedule deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete schedule: ${error.message}`);
    },
  });
}

export function useToggleSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('report_schedules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success(is_active ? 'Schedule activated' : 'Schedule paused');
    },
    onError: (error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });
}
