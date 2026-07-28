import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledReport {
  id: string;
  name: string;
  template_id: string | null;
  recipients: string[];
  region_id: string | null;
  metro_id: string | null;
  report_templates?: {
    name: string;
    sections: string[];
  } | null;
}

interface ReportData {
  title: string;
  subtitle: string;
  kpis: { label: string; value: string | number }[];
  sections: { title: string; content: string }[];
}

interface AnchorRow {
  id: string;
  first_volume_date: string | null;
  avg_monthly_volume: number | null;
  metro_id: string | null;
}

interface OpportunityRow {
  id: string;
  status: string | null;
  metro_id: string | null;
}

interface PipelineRow {
  id: string;
  stage: string | null;
  target_first_volume_date: string | null;
  metro_id: string | null;
}

interface MetroRow {
  id: string;
  metro: string;
}

interface RegionRow {
  id: string;
  name: string;
}

async function generateReportData(
  supabase: any,
  schedule: ScheduledReport
): Promise<ReportData> {
  // Build filters
  const metroFilter = schedule.metro_id;
  let metroIds: string[] = [];
  
  if (metroFilter) {
    metroIds = [metroFilter];
  } else if (schedule.region_id) {
    const { data: metros } = await supabase
      .from('metros')
      .select('id')
      .eq('region_id', schedule.region_id);
    metroIds = ((metros || []) as { id: string }[]).map(m => m.id);
  }

  // Fetch data
  let anchorsQuery = supabase.from('anchors').select('id, first_volume_date, avg_monthly_volume, metro_id');
  let opportunitiesQuery = supabase.from('opportunities').select('id, status, metro_id');
  let pipelineQuery = supabase.from('anchor_pipeline').select('id, stage, target_first_volume_date, metro_id');

  if (metroIds.length > 0) {
    anchorsQuery = anchorsQuery.in('metro_id', metroIds);
    opportunitiesQuery = opportunitiesQuery.in('metro_id', metroIds);
    pipelineQuery = pipelineQuery.in('metro_id', metroIds);
  }

  const [anchorsRes, opportunitiesRes, pipelineRes] = await Promise.all([
    anchorsQuery,
    opportunitiesQuery,
    pipelineQuery,
  ]);

  const anchors = (anchorsRes.data || []) as AnchorRow[];
  const opportunities = (opportunitiesRes.data || []) as OpportunityRow[];
  const pipeline = (pipelineRes.data || []) as PipelineRow[];

  // Calculate KPIs
  const activeAnchors = anchors.filter(a => a.first_volume_date).length;
  const activeOpportunities = opportunities.filter(o => o.status === 'Active').length;
  const pipelineDeals = pipeline.length;
  const totalVolume = anchors.reduce((sum, a) => sum + (a.avg_monthly_volume || 0), 0);

  // Calculate forecasts
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const forecast30 = pipeline.filter(p => {
    if (!p.target_first_volume_date) return false;
    const target = new Date(p.target_first_volume_date);
    return target > today && target <= in30Days;
  }).length;

  const forecast60 = pipeline.filter(p => {
    if (!p.target_first_volume_date) return false;
    const target = new Date(p.target_first_volume_date);
    return target > in30Days && target <= in60Days;
  }).length;

  const forecast90 = pipeline.filter(p => {
    if (!p.target_first_volume_date) return false;
    const target = new Date(p.target_first_volume_date);
    return target > in60Days && target <= in90Days;
  }).length;

  // Pipeline by stage
  const pipelineByStage = pipeline.reduce((acc, p) => {
    const stage = p.stage || 'Unknown';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pipelineContent = Object.entries(pipelineByStage)
    .map(([stage, count]) => `• ${stage}: ${count}`)
    .join('\n');

  // Get region/metro name for title
  let scopeName = 'All Regions';
  if (schedule.metro_id) {
    const { data: metro } = await supabase
      .from('metros')
      .select('metro')
      .eq('id', schedule.metro_id)
      .single();
    const metroData = metro as MetroRow | null;
    scopeName = metroData?.metro || 'Metro';
  } else if (schedule.region_id) {
    const { data: region } = await supabase
      .from('regions')
      .select('name')
      .eq('id', schedule.region_id)
      .single();
    const regionData = region as RegionRow | null;
    scopeName = regionData?.name || 'Region';
  }

  return {
    title: schedule.report_templates?.name || schedule.name,
    subtitle: scopeName,
    kpis: [
      { label: 'Active Anchors', value: activeAnchors },
      { label: 'Active Opportunities', value: activeOpportunities },
      { label: 'Pipeline Deals', value: pipelineDeals },
      { label: 'Monthly Volume', value: totalVolume.toLocaleString() },
    ],
    sections: [
      {
        title: 'Anchor Forecast',
        content: `30-Day: ${forecast30} expected anchors\n60-Day: ${forecast60} expected anchors\n90-Day: ${forecast90} expected anchors`,
      },
      {
        title: 'Pipeline by Stage',
        content: pipelineContent || 'No pipeline data',
      },
    ],
  };
}

function generateEmailHtml(report: ReportData, scheduleName: string): string {
  const kpisHtml = report.kpis
    .map(
      kpi => `
      <td style="padding: 16px; background-color: #f8fafc; border-radius: 8px; text-align: center; min-width: 120px;">
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${kpi.label}</div>
        <div style="font-size: 24px; font-weight: bold; color: #1e293b;">${kpi.value}</div>
      </td>
    `
    )
    .join('<td style="width: 12px;"></td>');

  const sectionsHtml = report.sections
    .map(
      section => `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">${section.title}</h3>
        <div style="color: #475569; font-size: 14px; white-space: pre-line; background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 3px solid #3b82f6;">
          ${section.content}
        </div>
      </div>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; margin-bottom: 0;">
        <h1 style="margin: 0 0 4px 0; font-size: 24px;">${report.title}</h1>
        <p style="margin: 0; opacity: 0.9; font-size: 14px;">${report.subtitle}</p>
        <p style="margin: 8px 0 0 0; opacity: 0.7; font-size: 12px;">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      
      <!-- KPIs -->
      <div style="background-color: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">Key Metrics</h2>
        <table style="width: 100%; border-collapse: separate; border-spacing: 8px;">
          <tr>
            ${kpisHtml}
          </tr>
        </table>
      </div>
      
      <!-- Sections -->
      <div style="background-color: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        ${sectionsHtml}
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
        <p style="margin: 0 0 4px 0;">This is an automated report from PCs for People</p>
        <p style="margin: 0;">Schedule: ${scheduleName}</p>
      </div>
      
    </body>
    </html>
  `;
}

async function sendEmailWithResend(
  to: string[],
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CROS <reports@thecros.com>',
        to,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to send email' };
    }

    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authorization - required for cron and manual triggers
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    // Verify the token is either the anon key (for cron) or a valid user JWT
    const token = authHeader.replace("Bearer ", "");
    if (token !== SUPABASE_ANON_KEY) {
      const supabaseAuth = createClient(supabaseUrl, SUPABASE_ANON_KEY || "", {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: claims, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !claims.user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get schedule ID from request body (if manual trigger) or process all due schedules
    const body = await req.json().catch(() => ({}));
    const { schedule_id, test_mode } = body;

    let schedulesToProcess: ScheduledReport[] = [];

    if (schedule_id) {
      // Manual trigger for specific schedule
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*, report_templates(name, sections)')
        .eq('id', schedule_id)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error('Schedule not found or inactive');
      }

      schedulesToProcess = [data as unknown as ScheduledReport];
    } else {
      // Cron trigger - get all due schedules
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentDay = now.getUTCDay();
      const currentDate = now.getUTCDate();

      const { data: schedules, error } = await supabase
        .from('report_schedules')
        .select('*, report_templates(name, sections)')
        .eq('is_active', true);

      if (error) throw error;

      // Filter schedules that are due
      type ScheduleRow = {
        id: string;
        name: string;
        template_id: string | null;
        recipients: string[];
        region_id: string | null;
        metro_id: string | null;
        frequency: string;
        day_of_week: number | null;
        day_of_month: number | null;
        time_of_day: string;
        report_templates: { name: string; sections: string[] } | null;
      };

      schedulesToProcess = ((schedules || []) as ScheduleRow[]).filter(s => {
        // For simplicity, we check if it's roughly the right time
        const scheduleHour = parseInt(s.time_of_day.split(':')[0]);
        if (Math.abs(scheduleHour - currentHour) > 1) return false;

        switch (s.frequency) {
          case 'daily':
            return true;
          case 'weekly':
            return s.day_of_week === currentDay;
          case 'monthly':
            return s.day_of_month === currentDate;
          default:
            return false;
        }
      }) as ScheduledReport[];
    }

    const results = [];

    for (const schedule of schedulesToProcess) {
      try {
        // Generate report data
        const reportData = await generateReportData(supabase, schedule);
        const emailHtml = generateEmailHtml(reportData, schedule.name);

        if (test_mode) {
          // In test mode, just return the HTML without sending
          results.push({
            schedule_id: schedule.id,
            schedule_name: schedule.name,
            status: 'test',
            html_preview: emailHtml.substring(0, 500) + '...',
          });
          continue;
        }

        // Send email to all recipients
        const emailResult = await sendEmailWithResend(
          schedule.recipients,
          `📊 ${reportData.title} - ${reportData.subtitle}`,
          emailHtml
        );

        if (emailResult.success) {
          // Update last_sent_at
          await supabase
            .from('report_schedules')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('id', schedule.id);

          results.push({
            schedule_id: schedule.id,
            schedule_name: schedule.name,
            status: 'sent',
            recipients: schedule.recipients,
            email_id: emailResult.id,
          });
        } else {
          results.push({
            schedule_id: schedule.id,
            schedule_name: schedule.name,
            status: 'error',
            error: emailResult.error,
          });
        }
      } catch (err) {
        console.error(`Failed to process schedule ${schedule.id}:`, err);
        results.push({
          schedule_id: schedule.id,
          schedule_name: schedule.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in send-scheduled-report:", error);
    // Return generic error to client, keep details server-side
    return new Response(
      JSON.stringify({ success: false, error: "ERR_REPORT_001" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
