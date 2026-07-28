import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Email cleanup (30-day retention)
    const emailRetentionDays = 30;
    const emailCutoffDate = new Date();
    emailCutoffDate.setDate(emailCutoffDate.getDate() - emailRetentionDays);

    const { data: emailData, error: emailError } = await supabaseAdmin
      .from("email_communications")
      .delete()
      .lt("sent_at", emailCutoffDate.toISOString())
      .select("id");

    if (emailError) {
      console.error("[cleanup-old-emails] Email delete error:", emailError);
      throw emailError;
    }

    const deletedEmails = emailData?.length || 0;
    console.log(
      `[cleanup-old-emails] Deleted ${deletedEmails} emails older than ${emailRetentionDays} days`
    );

    // Rate limit cleanup (7-day retention)
    const rateLimitRetentionDays = 7;
    const rateLimitCutoffDate = new Date();
    rateLimitCutoffDate.setDate(rateLimitCutoffDate.getDate() - rateLimitRetentionDays);

    const { error: rateLimitError, count: rateLimitCount } = await supabaseAdmin
      .from("edge_function_rate_limits")
      .delete({ count: 'exact' })
      .lt("window_start", rateLimitCutoffDate.toISOString());

    if (rateLimitError) {
      console.error("[cleanup-old-emails] Rate limit delete error:", rateLimitError);
      // Don't throw - email cleanup succeeded, just log the rate limit error
    }

    const deletedRateLimits = rateLimitCount || 0;
    console.log(
      `[cleanup-old-emails] Deleted ${deletedRateLimits} rate limit records older than ${rateLimitRetentionDays} days`
    );

    return new Response(
      JSON.stringify({
        success: true,
        emails_deleted: deletedEmails,
        email_cutoff_date: emailCutoffDate.toISOString(),
        email_retention_days: emailRetentionDays,
        rate_limits_deleted: deletedRateLimits,
        rate_limit_cutoff_date: rateLimitCutoffDate.toISOString(),
        rate_limit_retention_days: rateLimitRetentionDays,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cleanup-old-emails] Error:", message);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
