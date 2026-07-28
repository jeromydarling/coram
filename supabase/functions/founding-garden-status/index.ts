import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: program, error } = await svc
      .from("founding_garden_program")
      .select("is_active, cap, purchased_count, ends_at")
      .eq("key", "founding_garden_2026_launch")
      .single();

    if (error || !program) {
      return new Response(
        JSON.stringify({ ok: true, is_active: false, cap: 0, purchased_count: 0, remaining: 0, is_available: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const remaining = Math.max(0, program.cap - program.purchased_count);
    const is_available = program.is_active && program.purchased_count < program.cap && !program.ends_at;

    return new Response(
      JSON.stringify({
        ok: true,
        is_active: program.is_active,
        cap: program.cap,
        purchased_count: program.purchased_count,
        remaining,
        is_available,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
