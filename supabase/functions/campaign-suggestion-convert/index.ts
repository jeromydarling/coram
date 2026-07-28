import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  // Auth: get user from JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  // RBAC check
  const { data: roles } = await createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    .from("user_roles").select("role").eq("user_id", user.id);
  const userRoles = (roles || []).map((r: { role: string }) => r.role);
  const canConvert = ["admin", "leadership", "regional_lead", "staff"].some(r => userRoles.includes(r));
  if (!canConvert) return json({ error: "Forbidden" }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = (body.action as string) || "convert";
  const suggestionId = body.suggestion_id as string;
  if (!suggestionId) return json({ error: "suggestion_id required" }, 400);

  // Load suggestion
  const { data: suggestion, error: sugErr } = await admin
    .from("campaign_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();
  if (sugErr || !suggestion) return json({ error: "Suggestion not found" }, 404);

  // ── DISMISS ──
  if (action === "dismiss") {
    await admin.from("campaign_suggestions")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", suggestionId);
    return json({ ok: true, action: "dismissed" });
  }

  // ── SNOOZE ──
  if (action === "snooze") {
    const days = typeof body.days === "number" ? body.days : 7;
    const until = new Date(Date.now() + days * 86400000).toISOString();
    await admin.from("campaign_suggestions")
      .update({ status: "snoozed", snoozed_until: until, updated_at: new Date().toISOString() })
      .eq("id", suggestionId);
    return json({ ok: true, action: "snoozed", snoozed_until: until });
  }

  // ── CONVERT ──
  if (suggestion.status === "converted") {
    return json({ ok: true, already_converted: true, campaign_id: suggestion.converted_campaign_id });
  }

  // Get org name from opportunities table (org_id may reference opportunity)
  let orgName = "Organization";
  const { data: opp } = await admin
    .from("opportunities")
    .select("organization")
    .eq("id", suggestion.org_id)
    .maybeSingle();
  if (opp) orgName = opp.organization;

  // Render body template
  const renderedBody = (suggestion.body_template as string)
    .replace(/\{\{org_name\}\}/gi, orgName)
    .replace(/\{\{signal_summary\}\}/gi, suggestion.reason || "recent website update")
    .replace(/\{\{first_name\}\}/gi, "")
    .replace(/\{\{metro_or_region\}\}/gi, "your area")
    .replace(/\{\{sender_name\}\}/gi, "");

  // Create draft campaign
  const { data: campaign, error: campErr } = await admin
    .from("email_campaigns")
    .insert({
      name: `Outreach: ${orgName} (Website update)`,
      subject: suggestion.subject,
      html_body: renderedBody,
      status: "draft",
      created_by: user.id,
      metadata: {
        source: "campaign_suggestions",
        suggestion_id: suggestionId,
        org_id: suggestion.org_id,
      },
    })
    .select("id")
    .single();

  if (campErr) return json({ error: `Campaign create failed: ${campErr.message}` }, 500);

  // Build audience from org contacts (up to 5)
  const { data: contacts } = await admin
    .from("contacts")
    .select("id, email, name")
    .eq("opportunity_id", suggestion.org_id)
    .not("email", "is", null)
    .limit(5);

  let audienceCount = 0;
  if (contacts && contacts.length > 0) {
    const rows = contacts.map((c: { id: string; email: string; name: string | null }) => ({
      campaign_id: campaign.id,
      contact_id: c.id,
      email: c.email.toLowerCase().trim(),
      name: c.name,
      status: "queued",
      source: "suggestion_convert",
      fingerprint: `${campaign.id}|${c.email.toLowerCase().trim()}`,
    }));

    const { error: audErr } = await admin.from("email_campaign_audience").insert(rows);
    if (!audErr) audienceCount = rows.length;
  }

  // Update campaign audience_count
  if (audienceCount > 0) {
    await admin.from("email_campaigns")
      .update({ audience_count: audienceCount })
      .eq("id", campaign.id);
  }

  // Mark suggestion converted
  await admin.from("campaign_suggestions")
    .update({
      status: "converted",
      converted_campaign_id: campaign.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  // Emit event
  await admin.from("email_campaign_events").insert({
    campaign_id: campaign.id,
    event_type: "suggestion_converted",
    message: `Created from watchlist suggestion for ${orgName}`,
    meta: { suggestion_id: suggestionId, org_id: suggestion.org_id, audience_count: audienceCount },
  });

  return json({
    ok: true,
    action: "converted",
    campaign_id: campaign.id,
    audience_count: audienceCount,
    org_name: orgName,
  });
});
