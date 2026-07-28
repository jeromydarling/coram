import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the signup link
    const { data: link, error: linkError } = await supabaseAdmin
      .from("operator_signup_links")
      .select("*")
      .eq("slug", slug)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Invalid tracking link" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a lead opportunity with conversion_source
    const opportunityId = `LEAD-${slug.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const { error: insertError } = await supabaseAdmin
      .from("opportunities")
      .insert({
        opportunity_id: opportunityId,
        organization: `Lead from ${link.campaign_name}`,
        stage: "Target Identified",
        status: "Active",
        conversion_source: link.campaign_name,
        notes: `Auto-created from tracking link: ${slug}`,
      });

    if (insertError) {
      console.error("Failed to create lead opportunity:", insertError);
      // Still redirect even if insert fails
    }

    // Redirect to pricing page
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const redirectUrl = origin ? `${new URL(origin).origin}/pricing` : "/pricing";

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
      },
    });
  } catch (err) {
    console.error("operator-signup-track error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
