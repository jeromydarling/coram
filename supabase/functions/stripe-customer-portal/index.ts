import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "stripe_not_configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }

  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { tenant_id, return_url } = body;

    if (!tenant_id) return jsonError(400, "bad_request", "tenant_id required");

    // Verify tenant admin
    const { data: tu } = await svc
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();

    if (!tu || tu.role !== "admin") {
      return jsonError(403, "forbidden", "Only tenant admins can manage billing");
    }

    const { data: sub } = await svc
      .from("tenant_subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", tenant_id)
      .single();

    if (!sub?.stripe_customer_id) {
      return jsonError(404, "not_found", "No billing customer found. Start a subscription first.");
    }

    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: sub.stripe_customer_id,
        return_url: return_url ?? `${supabaseUrl.replace('.supabase.co', '')}/settings`,
      }),
    });
    const portal = await portalRes.json();
    if (!portalRes.ok) throw new Error(portal.error?.message ?? "Failed to create portal session");

    return jsonOk({ ok: true, url: portal.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(500, "internal_error", msg);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
