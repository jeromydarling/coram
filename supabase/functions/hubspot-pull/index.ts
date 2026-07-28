/**
 * HubSpot Pull Preview + Apply
 * - preview: Read-only diff from HubSpot, ZERO DB writes
 * - apply: Writes after explicit confirmation, safe field merge
 *
 * NARRATIVE BOUNDARY: The following Profunda fields are NEVER overwritten
 * by pull operations, regardless of overwrite_mode. Profunda is the
 * source of truth for partner progression and relationship narrative:
 *   - stage, status, partner_tier, best_partnership_angle, notes
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUBSPOT_CLIENT_ID = Deno.env.get("HUBSPOT_CLIENT_ID") || "";
const HUBSPOT_CLIENT_SECRET = Deno.env.get("HUBSPOT_CLIENT_SECRET") || "";

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUserFromAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

async function refreshToken(refreshTokenStr: string, connId: string, supabase: ReturnType<typeof getServiceClient>): Promise<string | null> {
  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) return null;
  const resp = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshTokenStr,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  await supabase.from("hubspot_connections").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq("id", connId);
  return data.access_token;
}

interface DiffItem {
  hubspotId: string;
  hubspotName: string;
  hubspotDomain: string | null;
  matchType: "domain" | "name" | "none";
  matchConfidence: "high" | "medium" | "ambiguous" | "new";
  profundaId: string | null;
  profundaName: string | null;
  profundaMetro: string | null;
  profundaStage: string | null;
  hubspotStage: string | null;
  stageSimilarity: number; // 0-1 score
  fieldDiffs: Array<{
    field: string;
    profundaValue: string | null;
    hubspotValue: string | null;
    wouldOverwrite: boolean;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserFromAuth(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const supabase = getServiceClient();

    // Get connection
    const { data: conn } = await supabase
      .from("hubspot_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ error: "No active connection" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (conn.sync_direction !== "push_pull") {
      return new Response(JSON.stringify({ error: "Pull is not enabled. Update sync direction to 'push_pull' first." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get access token
    let accessToken = conn.access_token;
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      accessToken = await refreshToken(conn.refresh_token, conn.id, supabase);
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Token refresh failed" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === PREVIEW ===
    if (action === "preview") {
      const objectType = conn.hubspot_mode === "deal" ? "deals" : "companies";
      const properties = conn.hubspot_mode === "deal"
        ? ["dealname", "pipeline", "dealstage", "profunda_journey_stage"]
        : ["name", "domain", "website", "city", "state", "zip", "profunda_journey_stage"];

      const hsResp = await fetch(
        `https://api.hubapi.com/crm/v3/objects/${objectType}?limit=100&properties=${properties.join(",")}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!hsResp.ok) {
        return new Response(JSON.stringify({ error: `HubSpot API error: ${hsResp.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hsData = await hsResp.json();
      const hsObjects = hsData.results || [];

      // Get all opportunities for matching
      const { data: opps } = await supabase
        .from("opportunities")
        .select("id, organization, website_domain, website_url, city, state, zip, stage, status, metro_id");

      // Get metro names for metro matching
      const metroIds = [...new Set((opps || []).map(o => o.metro_id).filter(Boolean))];
      const metroMap = new Map<string, string>();
      if (metroIds.length > 0) {
        const { data: metros } = await supabase
          .from("metros")
          .select("id, name")
          .in("id", metroIds);
        for (const m of metros || []) {
          metroMap.set(m.id, m.name);
        }
      }

      const oppByDomain = new Map<string, Record<string, unknown>>();
      const oppByName = new Map<string, Record<string, unknown>>();
      for (const opp of opps || []) {
        if (opp.website_domain) oppByDomain.set(opp.website_domain.toLowerCase(), opp);
        oppByName.set((opp.organization || "").toLowerCase(), opp);
      }

      const diffs: DiffItem[] = [];

      for (const hsObj of hsObjects) {
        const props = hsObj.properties || {};
        const hsName = props.name || props.dealname || "";
        const hsDomain = props.domain || null;

        let matchType: DiffItem["matchType"] = "none";
        let matchConfidence: DiffItem["matchConfidence"] = "new";
        let profundaOpp: Record<string, unknown> | null = null;

        // Try domain match first
        if (hsDomain) {
          const normalized = hsDomain.toLowerCase().replace(/^www\./, "");
          profundaOpp = oppByDomain.get(normalized) || null;
          if (profundaOpp) {
            matchType = "domain";
            matchConfidence = "high";
          }
        }

        // Fallback: name match
        if (!profundaOpp && hsName) {
          profundaOpp = oppByName.get(hsName.toLowerCase()) || null;
          if (profundaOpp) {
            matchType = "name";
            // Check if there are multiple name matches
            const nameMatches = (opps || []).filter(o => (o.organization || "").toLowerCase() === hsName.toLowerCase());
            matchConfidence = nameMatches.length === 1 ? "medium" : "ambiguous";
          }
        }

        const fieldDiffs: DiffItem["fieldDiffs"] = [];
        if (profundaOpp) {
          // Compare fields
          const comparisons: Array<[string, string | null, string | null]> = [
            ["organization", profundaOpp.organization as string, hsName],
            ["city", profundaOpp.city as string, props.city || null],
            ["state", profundaOpp.state as string, props.state || null],
            ["zip", profundaOpp.zip as string, props.zip || null],
          ];

          for (const [field, pVal, hsVal] of comparisons) {
            if (hsVal && hsVal !== pVal) {
              fieldDiffs.push({
                field,
                profundaValue: pVal || null,
                hubspotValue: hsVal,
                wouldOverwrite: !!pVal, // Would overwrite if Profunda has a value
              });
            }
          }
        }

        // Compute stage similarity
        const hsStage = props.profunda_journey_stage || props.dealstage || null;
        const pStage = profundaOpp ? (profundaOpp.stage as string) || null : null;
        let stageSimilarity = 0;
        if (hsStage && pStage) {
          stageSimilarity = hsStage.toLowerCase() === pStage.toLowerCase() ? 1.0 : 0.0;
          // Partial match: check if one contains the other
          if (stageSimilarity === 0 && (hsStage.toLowerCase().includes(pStage.toLowerCase()) || pStage.toLowerCase().includes(hsStage.toLowerCase()))) {
            stageSimilarity = 0.5;
          }
        }

        const profundaMetroId = profundaOpp ? (profundaOpp.metro_id as string) || null : null;

        diffs.push({
          hubspotId: hsObj.id,
          hubspotName: hsName,
          hubspotDomain: hsDomain,
          matchType,
          matchConfidence,
          profundaId: profundaOpp ? (profundaOpp.id as string) : null,
          profundaName: profundaOpp ? (profundaOpp.organization as string) : null,
          profundaMetro: profundaMetroId ? (metroMap.get(profundaMetroId) || null) : null,
          profundaStage: pStage,
          hubspotStage: hsStage,
          stageSimilarity,
          fieldDiffs,
        });
      }

      const summary = {
        total: diffs.length,
        matched_high: diffs.filter(d => d.matchConfidence === "high").length,
        matched_medium: diffs.filter(d => d.matchConfidence === "medium").length,
        ambiguous: diffs.filter(d => d.matchConfidence === "ambiguous").length,
        new_records: diffs.filter(d => d.matchConfidence === "new").length,
        fields_would_overwrite: diffs.reduce((sum, d) => sum + d.fieldDiffs.filter(f => f.wouldOverwrite).length, 0),
      };

      // NOTE: This is PREVIEW ONLY — zero DB writes
      return new Response(JSON.stringify({ preview: true, summary, diffs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === APPLY ===
    if (action === "apply" && req.method === "POST") {
      const body = await req.json();
      const { items, overwrite_mode = false } = body;

      // NARRATIVE BOUNDARY: These fields are NEVER writable via pull.
      // Profunda is the canonical source of truth for partner progression.
      const PROTECTED_FIELDS = new Set([
        'stage', 'status', 'partner_tier', 'best_partnership_angle',
        'notes', 'owner_id', 'metro_id',
      ]);

      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: "No items to apply" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Admin check for overwrite mode
      if (overwrite_mode) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const isAdmin = (roles || []).some((r: { role: string }) => r.role === "admin");
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Overwrite mode requires admin role" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const applied: string[] = [];
      const skipped: string[] = [];
      const created: string[] = [];

      for (const item of items.slice(0, 50)) {
        const { hubspotId, profundaId, fields } = item;

        if (profundaId) {
          // Update existing opportunity
          const updates: Record<string, unknown> = {};

          for (const field of fields || []) {
            // Enforce narrative boundary — skip protected fields always
            if (PROTECTED_FIELDS.has(field.field)) continue;

            if (!overwrite_mode) {
              // Safe default: only fill empty fields
              const { data: existing } = await supabase
                .from("opportunities")
                .select(field.field)
                .eq("id", profundaId)
                .maybeSingle();

              if (existing && (existing as Record<string, unknown>)[field.field]) {
                continue; // Skip non-empty fields
              }
            }
            updates[field.field] = field.hubspotValue;
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from("opportunities").update(updates).eq("id", profundaId);
            applied.push(profundaId);
          } else {
            skipped.push(profundaId);
          }

          // Update object map
          await supabase.from("hubspot_object_map").upsert({
            connection_id: conn.id,
            opportunity_id: profundaId,
            hubspot_company_id: conn.hubspot_mode === "company" ? hubspotId : null,
            hubspot_deal_id: conn.hubspot_mode === "deal" ? hubspotId : null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: "connection_id,opportunity_id" });
        }

        // Log pull
        await supabase.from("hubspot_sync_log").insert({
          connection_id: conn.id,
          direction: "pull",
          entity: conn.hubspot_mode === "deal" ? "deal" : "company",
          profunda_id: profundaId || null,
          hubspot_id: hubspotId,
          status: profundaId ? (applied.includes(profundaId) ? "ok" : "skipped") : "ok",
          message: profundaId ? null : "New record would need to be created manually",
        });
      }

      return new Response(JSON.stringify({
        success: true,
        applied: applied.length,
        skipped: skipped.length,
        created: created.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use ?action=preview or ?action=apply" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hubspot-pull] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
