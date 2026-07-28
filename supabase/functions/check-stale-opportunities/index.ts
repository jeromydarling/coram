import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StaleOpportunity {
  id: string;
  organization: string;
  stage: string;
  last_contact_date: string | null;
  days_since_contact: number;
  owner_email?: string;
  metro_name?: string;
}

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
    
    // Calculate date 14 days ago
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - 14);
    const thresholdDate = staleThreshold.toISOString().split('T')[0];

    // Get opportunities with no recent activity
    const { data: staleOpportunities, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        id,
        organization,
        stage,
        last_contact_date,
        owner_id,
        metros (metro)
      `)
      .eq("status", "Active")
      .or(`last_contact_date.is.null,last_contact_date.lt.${thresholdDate}`);

    if (oppError) throw oppError;

    // Get owner emails
    const ownerIds = new Set<string>();
    staleOpportunities?.forEach(o => o.owner_id && ownerIds.add(o.owner_id));

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const userEmailMap = new Map<string, string>();
    authUsers?.users?.forEach(u => userEmailMap.set(u.id, u.email || ''));

    // Build stale items list
    const staleItems: StaleOpportunity[] = staleOpportunities?.map(opp => {
      const lastContact = opp.last_contact_date ? new Date(opp.last_contact_date) : null;
      const daysSince = lastContact 
        ? Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
        : 999; // Never contacted
      
      return {
        id: opp.id,
        organization: opp.organization,
        stage: opp.stage || 'Unknown',
        last_contact_date: opp.last_contact_date,
        days_since_contact: daysSince,
        owner_email: opp.owner_id ? userEmailMap.get(opp.owner_id) : undefined,
        metro_name: (opp.metros as any)?.metro
      };
    }) || [];

    // Group by owner email
    const byOwner = new Map<string, StaleOpportunity[]>();
    staleItems.forEach(item => {
      if (item.owner_email) {
        const existing = byOwner.get(item.owner_email) || [];
        existing.push(item);
        byOwner.set(item.owner_email, existing);
      }
    });

    // Send reminder emails
    const emailsSent: string[] = [];
    
    if (RESEND_API_KEY) {
      for (const [email, items] of byOwner.entries()) {
        const itemsList = items.map(i => 
          `• ${i.organization} (${i.stage}): ${i.days_since_contact === 999 ? 'Never contacted' : `${i.days_since_contact} days since last contact`}`
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
            subject: `📋 ${items.length} opportunit${items.length > 1 ? 'ies need' : 'y needs'} attention`,
            html: `
              <h2>Stale Opportunities Reminder</h2>
              <p>The following opportunities have had no activity in the last 14+ days:</p>
              <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${itemsList}</pre>
              <p>Consider reaching out or updating the status of these opportunities.</p>
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
        stale_count: staleItems.length,
        emails_sent: emailsSent.length,
        items: staleItems,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error checking stale opportunities:", error);
    // Return generic error to client, keep details server-side
    return new Response(
      JSON.stringify({ success: false, error: "ERR_STALE_001" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
