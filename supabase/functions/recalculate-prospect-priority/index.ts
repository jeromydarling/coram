import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const workerSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  const isWorker = workerSecret && token === workerSecret;

  if (!isWorker) {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return jsonError(401, "UNAUTHORIZED", "Invalid auth");
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty ok */ }

  // If contact_ids provided, score only those; otherwise score all
  let contactFilter: string[] | null = null;
  if (Array.isArray(body.contact_ids) && body.contact_ids.length > 0) {
    contactFilter = body.contact_ids as string[];
  }

  // Get contacts to score
  let contactQuery = admin.from("contacts").select("id, opportunity_id").limit(500);
  if (contactFilter) {
    contactQuery = contactQuery.in("id", contactFilter);
  }
  const { data: contacts, error: contactErr } = await contactQuery;

  if (contactErr || !contacts) {
    return jsonError(500, "DB_ERROR", contactErr?.message ?? "Failed to fetch contacts");
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get all signals, edges, and enrichment data in parallel
  const orgIds = [...new Set(contacts.map(c => c.opportunity_id).filter(Boolean))];
  const contactIds = contacts.map(c => c.id);

  const [signalsRes, edgesRes, enrichRes] = await Promise.all([
    admin.from("opportunity_signals")
      .select("organization_id, confidence, source_type, created_at")
      .in("organization_id", orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("created_at", thirtyDaysAgo),
    admin.from("relationship_edges")
      .select("source_id, target_id, source_type, target_type")
      .in("source_id", contactIds)
      .limit(1000),
    admin.from("enrichment_results")
      .select("opportunity_id, enrichment_type")
      .in("opportunity_id", orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"])
      .limit(1000),
  ]);

  const signals = signalsRes.data ?? [];
  const edges = edgesRes.data ?? [];
  const enrichments = enrichRes.data ?? [];

  // Build lookup maps
  const signalsByOrg: Record<string, { confidence: number; source_type: string; created_at: string }[]> = {};
  for (const s of signals) {
    if (!signalsByOrg[s.organization_id]) signalsByOrg[s.organization_id] = [];
    signalsByOrg[s.organization_id].push(s);
  }

  const edgesByContact: Record<string, number> = {};
  for (const e of edges) {
    edgesByContact[e.source_id] = (edgesByContact[e.source_id] || 0) + 1;
  }

  const enrichByOrg: Record<string, Set<string>> = {};
  for (const e of enrichments) {
    if (!enrichByOrg[e.opportunity_id]) enrichByOrg[e.opportunity_id] = new Set();
    enrichByOrg[e.opportunity_id].add(e.enrichment_type);
  }

  // Score each contact
  let updated = 0;
  for (const contact of contacts) {
    const orgId = contact.opportunity_id;

    // mission_alignment: from enrichment completeness (0-1)
    const enrichTypes = orgId ? enrichByOrg[orgId] : null;
    const missionAlignment = enrichTypes
      ? Math.min(1, enrichTypes.size / 4) // 4 enrichment types = full score
      : 0;

    // grant_overlap: from signal count with type=grant (0-1)
    const orgSignals = orgId ? signalsByOrg[orgId] ?? [] : [];
    const grantSignals = orgSignals.filter(s => s.source_type === "grant");
    const grantOverlap = Math.min(1, grantSignals.length / 3);

    // neighborhood_need_score: from neighborhood signals (0-1)
    const neighborhoodSignals = orgSignals.filter(s => s.source_type === "neighborhood");
    const neighborhoodScore = Math.min(1, neighborhoodSignals.length / 2);

    // relationship_strength: from edge count (0-1)
    const edgeCount = edgesByContact[contact.id] || 0;
    const relationshipStrength = Math.min(1, edgeCount / 5);

    // recency_signal_score: most recent signal freshness (0-1)
    let recencyScore = 0;
    if (orgSignals.length > 0) {
      const newest = orgSignals.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      );
      const daysSince = (Date.now() - new Date(newest.created_at).getTime()) / (1000 * 60 * 60 * 24);
      recencyScore = Math.max(0, 1 - daysSince / 30);
    }

    const priorityScore = Number((
      missionAlignment * 0.3 +
      grantOverlap * 0.25 +
      neighborhoodScore * 0.2 +
      relationshipStrength * 0.15 +
      recencyScore * 0.1
    ).toFixed(4));

    const { error: updateErr } = await admin
      .from("contacts")
      .update({ priority_score: priorityScore })
      .eq("id", contact.id);

    if (!updateErr) updated++;
  }

  return jsonOk({ ok: true, contacts_scored: updated, total_contacts: contacts.length });
});
