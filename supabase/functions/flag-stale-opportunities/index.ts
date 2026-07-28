import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role for automated task
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Run the flag_stale_opportunities function
    const { error: flagError } = await supabase.rpc('flag_stale_opportunities');
    
    if (flagError) {
      console.error("Error flagging stale opportunities:", flagError);
      throw flagError;
    }

    // Get count of newly flagged opportunities
    const { data: flaggedOpps, error: countError } = await supabase
      .from("opportunities")
      .select("id, organization")
      .eq("stale_flagged", true)
      .eq("status", "Active");

    if (countError) {
      throw countError;
    }

    console.log(`Flagged ${flaggedOpps?.length || 0} stale opportunities`);

    return new Response(JSON.stringify({
      success: true,
      flaggedCount: flaggedOpps?.length || 0,
      opportunities: flaggedOpps?.map(o => o.organization) || [],
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in flag-stale-opportunities:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
