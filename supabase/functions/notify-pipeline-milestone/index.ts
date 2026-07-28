import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Key milestones that trigger notifications
const MILESTONE_STAGES = ['Agreement Signed', 'First Volume'];

interface MilestonePayload {
  pipeline_id: string;
  pipeline_name: string;
  stage: string;
  owner_id?: string;
  metro_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authorization - required for database triggers and manual calls
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

    // Verify the token is either the anon key (for db trigger) or a valid user JWT
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
    
    // Parse the incoming payload
    const payload: MilestonePayload = await req.json();
    const { pipeline_id, pipeline_name, stage, owner_id, metro_name } = payload;

    if (!pipeline_id || !stage) {
      throw new Error("Missing required fields: pipeline_id and stage");
    }

    // Check if this is a milestone stage
    if (!MILESTONE_STAGES.includes(stage)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Stage "${stage}" is not a milestone, no notification sent` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admins and leadership to notify
    const { data: notifyRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "leadership"]);

    const notifyUserIds = new Set(notifyRoles?.map(r => r.user_id) || []);
    
    // Also include the owner
    if (owner_id) {
      notifyUserIds.add(owner_id);
    }

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const recipientEmails = authUsers?.users
      ?.filter(u => notifyUserIds.has(u.id) && u.email)
      .map(u => u.email!) || [];

    if (recipientEmails.length === 0 || !RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No recipients or email not configured" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine milestone type for styling
    const isAgreementSigned = stage === 'Agreement Signed';
    const isFirstVolume = stage === 'First Volume';

    const emoji = isFirstVolume ? '🎉' : '✅';
    const color = isFirstVolume ? '#4CAF50' : '#2196F3';
    const message = isFirstVolume 
      ? 'has reached First Volume! This is now an active anchor.'
      : 'has signed an agreement and is moving toward production.';

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${emoji} Pipeline Milestone!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="margin-top: 0; color: #333;">${pipeline_name}</h2>
          <p style="font-size: 16px; color: #555;">
            <strong>${pipeline_name}</strong> ${message}
          </p>
          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; background: #fff; border: 1px solid #eee;">
                <strong>Stage:</strong> ${stage}
              </td>
            </tr>
            ${metro_name ? `
            <tr>
              <td style="padding: 8px; background: #fff; border: 1px solid #eee;">
                <strong>Metro:</strong> ${metro_name}
              </td>
            </tr>
            ` : ''}
          </table>
          <p style="color: #888; font-size: 14px;">
            Log in to view full details and next steps.
          </p>
        </div>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PCs for People CRM <notifications@resend.dev>",
        to: recipientEmails,
        subject: `${emoji} ${pipeline_name} reached ${stage}!`,
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
        milestone: stage,
        pipeline: pipeline_name,
        recipients: recipientEmails.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending milestone notification:", error);
    // Return generic error to client, keep details server-side
    return new Response(
      JSON.stringify({ success: false, error: "ERR_MILESTONE_001" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
