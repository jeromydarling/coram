import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OverdueItem {
  id: string;
  type: 'opportunity' | 'pipeline';
  name: string;
  next_action: string;
  next_action_due: string;
  days_overdue: number;
  owner_email?: string;
  metro_name?: string;
  stage?: string;
}

// Stages that indicate notable activity has occurred (past "Target Identified")
const ACTIVE_OPPORTUNITY_STAGES = [
  'Contacted',
  'Discovery Scheduled',
  'Discovery Held',
  'Proposal Sent',
  'Agreement Pending',
  'Agreement Signed',
  'First Volume',
  'Stable Producer'
];

const ACTIVE_PIPELINE_STAGES = [
  'Contacted',
  'Discovery Held',
  'Proposal Sent',
  'Agreement Pending',
  'Agreement Signed',
  'First Volume'
];

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

    // Verify the token is either the anon key (for cron) or a valid user JWT
    const token = authHeader.replace("Bearer ", "");
    if (token !== SUPABASE_ANON_KEY) {
      // Validate as user JWT
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
    const now = new Date().toISOString();

    // Get overdue opportunities - only those with notable activity (past Target Identified)
    const { data: overdueOpportunities, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        id,
        organization,
        stage,
        next_step,
        next_action_due,
        owner_id,
        metros (metro)
      `)
      .lt("next_action_due", now)
      .not("next_action_due", "is", null)
      .eq("status", "Active")
      .in("stage", ACTIVE_OPPORTUNITY_STAGES);

    if (oppError) throw oppError;

    // Get overdue pipeline items - only those with notable activity (past Target Identified)
    const { data: overduePipeline, error: pipeError } = await supabase
      .from("anchor_pipeline")
      .select(`
        id,
        anchor_pipeline_id,
        stage,
        next_action,
        next_action_due,
        owner_id,
        metros (metro)
      `)
      .lt("next_action_due", now)
      .not("next_action_due", "is", null)
      .in("stage", ACTIVE_PIPELINE_STAGES);

    if (pipeError) throw pipeError;

    // Collect all owner IDs
    const ownerIds = new Set<string>();
    overdueOpportunities?.forEach(o => o.owner_id && ownerIds.add(o.owner_id));
    overduePipeline?.forEach(p => p.owner_id && ownerIds.add(p.owner_id));

    // Get owner profiles with emails
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", Array.from(ownerIds));

    // Get user emails from auth (via admin API)
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    
    const userEmailMap = new Map<string, string>();
    authUsers?.users?.forEach(u => userEmailMap.set(u.id, u.email || ''));

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

    // Build overdue items list
    const overdueItems: OverdueItem[] = [];

    overdueOpportunities?.forEach(opp => {
      const dueDate = new Date(opp.next_action_due);
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      overdueItems.push({
        id: opp.id,
        type: 'opportunity',
        name: opp.organization,
        next_action: opp.next_step || 'No action specified',
        next_action_due: opp.next_action_due,
        days_overdue: daysOverdue,
        owner_email: opp.owner_id ? userEmailMap.get(opp.owner_id) : undefined,
        metro_name: (opp.metros as any)?.metro
      });
    });

    overduePipeline?.forEach(pipe => {
      const dueDate = new Date(pipe.next_action_due);
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      overdueItems.push({
        id: pipe.id,
        type: 'pipeline',
        name: pipe.anchor_pipeline_id,
        next_action: pipe.next_action || 'No action specified',
        next_action_due: pipe.next_action_due,
        days_overdue: daysOverdue,
        owner_email: pipe.owner_id ? userEmailMap.get(pipe.owner_id) : undefined,
        metro_name: (pipe.metros as any)?.metro
      });
    });

    // Group by owner email for personalized notifications
    const byOwner = new Map<string, OverdueItem[]>();
    overdueItems.forEach(item => {
      if (item.owner_email) {
        const existing = byOwner.get(item.owner_email) || [];
        existing.push(item);
        byOwner.set(item.owner_email, existing);
      }
    });

    // Send emails if RESEND_API_KEY is configured
    const emailsSent: string[] = [];
    
    if (RESEND_API_KEY) {
      for (const [email, items] of byOwner.entries()) {
        const itemsList = items.map(i => 
          `• ${i.name} (${i.type}): ${i.next_action} - ${i.days_overdue} days overdue`
        ).join('\n');

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "PCs for People CRM <notifications@resend.dev>",
            to: [email],
            subject: `⚠️ You have ${items.length} overdue action${items.length > 1 ? 's' : ''}`,
            html: `
              <h2>Overdue Actions Alert</h2>
              <p>The following items have overdue next actions:</p>
              <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${itemsList}</pre>
              <p>Please log in to update these items.</p>
            `,
          }),
        });

        if (response.ok) {
          emailsSent.push(email);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        overdue_count: overdueItems.length,
        emails_sent: emailsSent.length,
        items: overdueItems,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error checking overdue actions:", error);
    // Return generic error to client, keep details server-side
    return new Response(
      JSON.stringify({ success: false, error: "ERR_OVERDUE_001" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
