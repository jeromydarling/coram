import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Verify the token is either the anon key (for cron) or a valid user JWT
    const token = authHeader.replace("Bearer ", "");
    if (token !== SUPABASE_ANON_KEY) {
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "", {
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Calculate date range (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    // Get week's activities from audit log
    const { data: auditLogs, error: auditError } = await supabase
      .from("audit_log")
      .select("*")
      .gte("created_at", weekAgoISO)
      .order("created_at", { ascending: false });

    if (auditError) throw auditError;

    // Count activities by type
    const activitySummary = {
      creates: auditLogs?.filter(l => l.action === 'create').length || 0,
      updates: auditLogs?.filter(l => l.action === 'update').length || 0,
      deletes: auditLogs?.filter(l => l.action === 'delete').length || 0,
    };

    const entityBreakdown: Record<string, number> = {};
    auditLogs?.forEach(log => {
      entityBreakdown[log.entity_type] = (entityBreakdown[log.entity_type] || 0) + 1;
    });

    // Get new anchors this week
    const { data: newAnchors, error: anchorError } = await supabase
      .from("anchors")
      .select("anchor_id, metros (metro), first_volume_date")
      .gte("created_at", weekAgoISO);

    if (anchorError) throw anchorError;

    // Get pipeline movements
    const { data: pipelineUpdates, error: pipeError } = await supabase
      .from("anchor_pipeline")
      .select("anchor_pipeline_id, stage, metros (metro)")
      .gte("updated_at", weekAgoISO);

    if (pipeError) throw pipeError;

    // Get admins and leadership to send digest to
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "leadership"]);

    const adminIds = adminRoles?.map(r => r.user_id) || [];

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const recipientEmails = authUsers?.users
      ?.filter(u => adminIds.includes(u.id) && u.email)
      .map(u => u.email!) || [];

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No recipients found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content
    const entitySummary = Object.entries(entityBreakdown)
      .map(([type, count]) => `  • ${type}: ${count} changes`)
      .join('\n');

    const anchorsList = newAnchors?.length 
      ? newAnchors.map(a => `  • ${a.anchor_id} (${(a.metros as any)?.metro || 'No metro'})`).join('\n')
      : '  No new anchors this week';

    const pipelineList = pipelineUpdates?.slice(0, 10)
      .map(p => `  • ${p.anchor_pipeline_id} → ${p.stage}`)
      .join('\n') || '  No pipeline updates';

    const weekEndDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const weekStartDate = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const htmlContent = `
      <h2>Weekly Activity Digest</h2>
      <p><strong>${weekStartDate} - ${weekEndDate}</strong></p>
      
      <h3>📊 Activity Summary</h3>
      <ul>
        <li><strong>${activitySummary.creates}</strong> records created</li>
        <li><strong>${activitySummary.updates}</strong> records updated</li>
        <li><strong>${activitySummary.deletes}</strong> records deleted</li>
      </ul>

      <h3>📁 By Entity Type</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${entitySummary}</pre>

      <h3>🎯 New Anchors (${newAnchors?.length || 0})</h3>
      <pre style="background: #e8f5e9; padding: 15px; border-radius: 5px;">${anchorsList}</pre>

      <h3>📈 Pipeline Activity</h3>
      <pre style="background: #e3f2fd; padding: 15px; border-radius: 5px;">${pipelineList}</pre>

      <p style="margin-top: 20px; color: #666;">
        This is an automated weekly digest. Log in to view full details.
      </p>
    `;

    // Send to all recipients
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PCs for People CRM <notifications@resend.dev>",
        to: recipientEmails,
        subject: `📊 Weekly CRM Digest: ${weekStartDate} - ${weekEndDate}`,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipientEmails.length,
        summary: {
          activities: activitySummary,
          new_anchors: newAnchors?.length || 0,
          pipeline_updates: pipelineUpdates?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending weekly digest:", error);
    // Return generic error to client, keep details server-side
    return new Response(
      JSON.stringify({ success: false, error: "ERR_DIGEST_001" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
