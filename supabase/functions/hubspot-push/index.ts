/**
 * HubSpot Push Engine
 * Pushes opportunities, contacts, provisions, tasks, reflections to HubSpot.
 * Supports Company-first and Deal-first modes.
 * Uses hubspot_object_map for idempotency + last_hash for skip-unchanged.
 *
 * NARRATIVE BOUNDARY: Profunda is the SOURCE OF TRUTH for journey stage,
 * relationship narrative, and partner progression. These fields are PUSH-ONLY
 * and must NEVER be overwritten by HubSpot pull operations. The following
 * fields are protected from reverse sync:
 *   - stage (journey stage)
 *   - status
 *   - partner_tier
 *   - best_partnership_angle
 *   - notes (relationship narrative)
 *   - opportunity_reflections (all)
 * See docs/integrations/hubspot.md for the full sync surface map.
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

function md5Hash(str: string): string {
  // Simple deterministic hash for payload fingerprinting
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

interface HubSpotConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  hubspot_mode: string;
  pipeline_id: string | null;
  stage_mapping: Record<string, string>;
  sync_scope: Record<string, boolean>;
  status: string;
}

async function refreshToken(conn: HubSpotConnection, supabase: ReturnType<typeof getServiceClient>): Promise<string | null> {
  if (conn.token_expires_at && new Date(conn.token_expires_at) > new Date()) {
    return conn.access_token;
  }
  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) return conn.access_token;

  const resp = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
    }),
  });

  if (!resp.ok) {
    console.error("Token refresh failed:", await resp.text());
    await supabase.from("hubspot_connections").update({ status: "error" }).eq("id", conn.id);
    return null;
  }

  const data = await resp.json();
  await supabase.from("hubspot_connections").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq("id", conn.id);

  return data.access_token;
}

async function hubspotRequest(
  method: string, path: string, accessToken: string, body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  opts.signal = controller.signal;

  try {
    const resp = await fetch(`https://api.hubapi.com${path}`, opts);
    clearTimeout(timeout);

    // Rate limit handling
    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get("Retry-After") || "2");
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      // Single retry
      const retryResp = await fetch(`https://api.hubapi.com${path}`, {
        ...opts, signal: undefined,
      });
      const retryData = await retryResp.json().catch(() => ({}));
      return { ok: retryResp.ok, status: retryResp.status, data: retryData };
    }

    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, status: 0, data: { error: String(e) } };
  }
}

interface PushResult {
  entity: string;
  profundaId: string;
  hubspotId?: string;
  status: "ok" | "skipped" | "failed";
  message?: string;
}

async function pushOpportunity(
  opp: Record<string, unknown>,
  metroName: string | null,
  conn: HubSpotConnection,
  accessToken: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<PushResult> {
  const oppId = opp.id as string;

  // Build payload
  const properties: Record<string, string> = {
    name: (opp.organization as string) || "",
    domain: (opp.website_domain as string) || "",
    website: (opp.website_url as string) || "",
    address: (opp.address_line1 as string) || "",
    city: (opp.city as string) || "",
    state: (opp.state as string) || "",
    zip: (opp.zip as string) || "",
    profunda_journey_stage: (opp.stage as string) || "",
    profunda_status: (opp.status as string) || "",
    profunda_partner_tier: (opp.partner_tier as string) || "",
    profunda_metro: metroName || "",
    profunda_last_touch: (opp.last_contact_date as string) || "",
  };

  // Remove empty values
  for (const key of Object.keys(properties)) {
    if (!properties[key]) delete properties[key];
  }

  const payloadHash = md5Hash(JSON.stringify(properties));

  // Check existing mapping
  const { data: mapping } = await supabase
    .from("hubspot_object_map")
    .select("id, hubspot_company_id, hubspot_deal_id, last_hash")
    .eq("connection_id", conn.id)
    .eq("opportunity_id", oppId)
    .is("contact_id", null)
    .is("provision_id", null)
    .maybeSingle();

  // Skip if unchanged
  if (mapping?.last_hash === payloadHash) {
    return { entity: "opportunity", profundaId: oppId, hubspotId: mapping.hubspot_company_id || mapping.hubspot_deal_id || undefined, status: "skipped", message: "Unchanged" };
  }

  let hubspotId: string | undefined;

  if (conn.hubspot_mode === "company") {
    if (mapping?.hubspot_company_id) {
      // Update
      const result = await hubspotRequest("PATCH", `/crm/v3/objects/companies/${mapping.hubspot_company_id}`, accessToken, { properties });
      if (!result.ok) {
        return { entity: "opportunity", profundaId: oppId, status: "failed", message: `Update failed: ${result.status}` };
      }
      hubspotId = mapping.hubspot_company_id;
    } else {
      // Create
      const result = await hubspotRequest("POST", "/crm/v3/objects/companies", accessToken, { properties });
      if (!result.ok) {
        return { entity: "opportunity", profundaId: oppId, status: "failed", message: `Create failed: ${result.status}` };
      }
      hubspotId = (result.data as Record<string, string>).id;
    }

    // Upsert mapping
    if (mapping) {
      await supabase.from("hubspot_object_map").update({
        hubspot_company_id: hubspotId,
        last_hash: payloadHash,
        last_synced_at: new Date().toISOString(),
      }).eq("id", mapping.id);
    } else {
      await supabase.from("hubspot_object_map").insert({
        connection_id: conn.id,
        opportunity_id: oppId,
        hubspot_company_id: hubspotId,
        last_hash: payloadHash,
        last_synced_at: new Date().toISOString(),
      });
    }
  } else {
    // Deal mode
    const dealProperties: Record<string, string> = {
      dealname: properties.name || "",
      profunda_journey_stage: properties.profunda_journey_stage || "",
    };

    // Map stage to deal stage
    const stageKey = opp.stage as string;
    if (stageKey && conn.stage_mapping[stageKey]) {
      dealProperties.dealstage = conn.stage_mapping[stageKey];
    }

    if (conn.pipeline_id) {
      dealProperties.pipeline = conn.pipeline_id;
    }

    if (mapping?.hubspot_deal_id) {
      const result = await hubspotRequest("PATCH", `/crm/v3/objects/deals/${mapping.hubspot_deal_id}`, accessToken, { properties: dealProperties });
      if (!result.ok) {
        return { entity: "opportunity", profundaId: oppId, status: "failed", message: `Deal update failed: ${result.status}` };
      }
      hubspotId = mapping.hubspot_deal_id;
    } else {
      const result = await hubspotRequest("POST", "/crm/v3/objects/deals", accessToken, { properties: dealProperties });
      if (!result.ok) {
        return { entity: "opportunity", profundaId: oppId, status: "failed", message: `Deal create failed: ${result.status}` };
      }
      hubspotId = (result.data as Record<string, string>).id;

      // Also create/find company for association
      if (properties.name) {
        const companyResult = await hubspotRequest("POST", "/crm/v3/objects/companies", accessToken, {
          properties: { name: properties.name, domain: properties.domain, website: properties.website },
        });
        if (companyResult.ok) {
          const companyId = (companyResult.data as Record<string, string>).id;
          // Associate deal to company
          await hubspotRequest("PUT", `/crm/v3/objects/deals/${hubspotId}/associations/companies/${companyId}/deal_to_company`, accessToken);
        }
      }
    }

    if (mapping) {
      await supabase.from("hubspot_object_map").update({
        hubspot_deal_id: hubspotId,
        last_hash: payloadHash,
        last_synced_at: new Date().toISOString(),
      }).eq("id", mapping.id);
    } else {
      await supabase.from("hubspot_object_map").insert({
        connection_id: conn.id,
        opportunity_id: oppId,
        hubspot_deal_id: hubspotId,
        last_hash: payloadHash,
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  return { entity: "opportunity", profundaId: oppId, hubspotId, status: "ok" };
}

async function pushContact(
  contact: Record<string, unknown>,
  conn: HubSpotConnection,
  accessToken: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<PushResult> {
  const contactId = contact.id as string;
  const nameParts = ((contact.name as string) || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const properties: Record<string, string> = {};
  if (firstName) properties.firstname = firstName;
  if (lastName) properties.lastname = lastName;
  if (contact.email) properties.email = contact.email as string;
  if (contact.phone) properties.phone = contact.phone as string;
  if (contact.title) properties.jobtitle = contact.title as string;

  const payloadHash = md5Hash(JSON.stringify(properties));

  const { data: mapping } = await supabase
    .from("hubspot_object_map")
    .select("id, hubspot_contact_id, last_hash")
    .eq("connection_id", conn.id)
    .eq("contact_id", contactId)
    .is("opportunity_id", null)
    .is("provision_id", null)
    .maybeSingle();

  if (mapping?.last_hash === payloadHash) {
    return { entity: "contact", profundaId: contactId, hubspotId: mapping.hubspot_contact_id || undefined, status: "skipped", message: "Unchanged" };
  }

  let hubspotId: string | undefined;

  if (mapping?.hubspot_contact_id) {
    const result = await hubspotRequest("PATCH", `/crm/v3/objects/contacts/${mapping.hubspot_contact_id}`, accessToken, { properties });
    if (!result.ok) {
      return { entity: "contact", profundaId: contactId, status: "failed", message: `Update failed: ${result.status}` };
    }
    hubspotId = mapping.hubspot_contact_id;
  } else {
    const result = await hubspotRequest("POST", "/crm/v3/objects/contacts", accessToken, { properties });
    if (!result.ok) {
      return { entity: "contact", profundaId: contactId, status: "failed", message: `Create failed: ${result.status}` };
    }
    hubspotId = (result.data as Record<string, string>).id;
  }

  if (mapping) {
    await supabase.from("hubspot_object_map").update({
      hubspot_contact_id: hubspotId,
      last_hash: payloadHash,
      last_synced_at: new Date().toISOString(),
    }).eq("id", mapping.id);
  } else {
    await supabase.from("hubspot_object_map").insert({
      connection_id: conn.id,
      contact_id: contactId,
      hubspot_contact_id: hubspotId,
      last_hash: payloadHash,
      last_synced_at: new Date().toISOString(),
    });
  }

  // Associate contact to company/deal if opportunity exists
  if (contact.opportunity_id) {
    const { data: oppMapping } = await supabase
      .from("hubspot_object_map")
      .select("hubspot_company_id, hubspot_deal_id")
      .eq("connection_id", conn.id)
      .eq("opportunity_id", contact.opportunity_id as string)
      .maybeSingle();

    if (oppMapping?.hubspot_company_id && hubspotId) {
      await hubspotRequest("PUT", `/crm/v3/objects/contacts/${hubspotId}/associations/companies/${oppMapping.hubspot_company_id}/contact_to_company`, accessToken);
    }
    if (oppMapping?.hubspot_deal_id && hubspotId) {
      await hubspotRequest("PUT", `/crm/v3/objects/contacts/${hubspotId}/associations/deals/${oppMapping.hubspot_deal_id}/contact_to_deal`, accessToken);
    }
  }

  return { entity: "contact", profundaId: contactId, hubspotId, status: "ok" };
}

async function authenticateRequest(req: Request): Promise<string | null> {
  // Service-to-service auth
  const apiKey = req.headers.get("x-api-key");
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const n8nSecret = Deno.env.get("N8N_SHARED_SECRET");

  if (apiKey && (apiKey === enrichmentSecret || apiKey === n8nSecret)) {
    return "service";
  }

  // Bearer token auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");

  // Check if it's the service role key
  if (token === SUPABASE_SERVICE_ROLE_KEY) return "service";

  // User JWT
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await authenticateRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      connection_id,
      opportunity_ids,
      contact_ids,
      user_id_override,
    } = body;

    const supabase = getServiceClient();
    const targetUserId = userId === "service" ? (user_id_override || null) : userId;

    // Get connection
    let query = supabase
      .from("hubspot_connections")
      .select("*")
      .eq("status", "active");

    if (connection_id) {
      query = query.eq("id", connection_id);
    } else if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: conn, error: connError } = await query.maybeSingle();
    if (connError || !conn) {
      return new Response(JSON.stringify({ error: "No active HubSpot connection found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connection = conn as unknown as HubSpotConnection;

    // Refresh token
    const accessToken = await refreshToken(connection, supabase);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token refresh failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: PushResult[] = [];

    // Push opportunities
    if (opportunity_ids?.length > 0 && connection.sync_scope.partners !== false) {
      const { data: opps } = await supabase
        .from("opportunities")
        .select("*, metros!opportunities_metro_id_fkey(name)")
        .in("id", opportunity_ids.slice(0, 50));

      for (const opp of opps || []) {
        const metroName = (opp as any).metros?.name || null;
        const result = await pushOpportunity(opp as Record<string, unknown>, metroName, connection, accessToken, supabase);
        results.push(result);

        // Log
        await supabase.from("hubspot_sync_log").insert({
          connection_id: connection.id,
          direction: "push",
          entity: "company",
          profunda_id: result.profundaId,
          hubspot_id: result.hubspotId || null,
          status: result.status,
          message: result.message || null,
        });

        // Delay between requests
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // Push contacts
    if (contact_ids?.length > 0 && connection.sync_scope.contacts !== false) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("*")
        .in("id", contact_ids.slice(0, 50));

      for (const contact of contacts || []) {
        const result = await pushContact(contact as Record<string, unknown>, connection, accessToken, supabase);
        results.push(result);

        await supabase.from("hubspot_sync_log").insert({
          connection_id: connection.id,
          direction: "push",
          entity: "contact",
          profunda_id: result.profundaId,
          hubspot_id: result.hubspotId || null,
          status: result.status,
          message: result.message || null,
        });

        await new Promise(r => setTimeout(r, 150));
      }
    }

    const summary = {
      total: results.length,
      ok: results.filter(r => r.status === "ok").length,
      skipped: results.filter(r => r.status === "skipped").length,
      failed: results.filter(r => r.status === "failed").length,
    };

    return new Response(JSON.stringify({ success: true, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hubspot-push] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
