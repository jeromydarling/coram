/**
 * relatio-job-status — Returns job details + events (tenant members).
 * GET ?job_id=...
 */
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id");

  if (!jobId) {
    return new Response(JSON.stringify({ error: "job_id query param required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // RLS ensures only tenant members see their jobs
  const { data: job, error: jobError } = await supabase
    .from("relatio_import_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: events } = await supabase
    .from("relatio_import_events")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(100);

  return new Response(JSON.stringify({ job, events: events || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
