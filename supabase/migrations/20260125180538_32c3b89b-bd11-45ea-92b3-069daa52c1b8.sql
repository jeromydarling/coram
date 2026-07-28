-- Create report templates table for custom report builder
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL DEFAULT 'custom',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create report schedules table for scheduled email reports
CREATE TABLE public.report_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.report_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  time_of_day TIME NOT NULL DEFAULT '08:00:00',
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  metro_id UUID REFERENCES public.metros(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

-- Report templates policies: admins can manage all, users can view shared templates
CREATE POLICY "Admins can manage all report templates"
  ON public.report_templates FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Users can view default templates"
  ON public.report_templates FOR SELECT
  USING (is_default = true AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own templates"
  ON public.report_templates FOR ALL
  USING (created_by = auth.uid());

-- Report schedules policies: admin and staff can manage schedules
CREATE POLICY "Admins can manage all schedules"
  ON public.report_schedules FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Staff can view schedules they created"
  ON public.report_schedules FOR SELECT
  USING (created_by = auth.uid() AND has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage their own schedules"
  ON public.report_schedules FOR ALL
  USING (created_by = auth.uid() AND has_role(auth.uid(), 'staff'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_report_schedules_updated_at
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default report templates
INSERT INTO public.report_templates (name, description, report_type, sections, is_default) VALUES
('Executive Summary', 'High-level KPIs and pipeline overview for board presentations', 'executive', 
  '["kpi_overview", "forecast_kpis", "pipeline_stage", "recent_wins", "top_opportunities"]'::jsonb, true),
('Regional Performance', 'Detailed breakdown by region with opportunities and anchors', 'regional',
  '["kpi_overview", "pipeline_stage", "recent_wins", "top_opportunities", "metro_breakdown"]'::jsonb, true),
('90-Day Forecast', 'Forward-looking pipeline analysis with anchor projections', 'forecast',
  '["kpi_overview", "forecast_kpis", "forecast_table", "pipeline_chart"]'::jsonb, true);