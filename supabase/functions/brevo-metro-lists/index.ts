import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// deno-lint-ignore no-explicit-any
async function brevoCreateList(apiKey: string, name: string): Promise<any> {
  const res = await fetch("https://api.brevo.com/v3/contacts/lists", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ name, folderId: 1 }),
  });
  if (res.ok) return res.json();
  if (res.status === 400) return null;
  throw new Error(`Brevo API error: ${res.status}`);
}

// deno-lint-ignore no-explicit-any
async function brevoSearchListByName(apiKey: string, name: string): Promise<any> {
  const res = await fetch("https://api.brevo.com/v3/contacts/lists?limit=50", {
    headers: { "api-key": apiKey },
  });
  if (!res.ok) throw new Error(`Brevo API error: ${res.status}`);
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  return (data.lists || []).find((l: any) => l.name === name) || null;
}

// deno-lint-ignore no-explicit-any
async function ensureOne(supabaseAdmin: any, apiKey: string, metroId: string): Promise<{ brevo_list_id: string; created: boolean }> {
  const { data: existing } = await supabaseAdmin
    .from("brevo_metro_lists")
    .select("brevo_list_id")
    .eq("metro_id", metroId)
    .maybeSingle();

  if (existing?.brevo_list_id) {
    return { brevo_list_id: existing.brevo_list_id, created: false };
  }

  const { data: metro } = await supabaseAdmin.from("metros").select("metro").eq("id", metroId).single();
  if (!metro?.metro) throw new Error(`Metro not found: ${metroId}`);

  const listName = `Profunda Metro — ${metro.metro}`;
  let brevoListId: number;
  const createResult = await brevoCreateList(apiKey, listName);

  if (createResult) {
    brevoListId = createResult.id;
  } else {
    const existingList = await brevoSearchListByName(apiKey, listName);
    if (!existingList) throw new Error(`Could not find or create Brevo list: ${listName}`);
    brevoListId = existingList.id;
  }

  const { error: insertError } = await supabaseAdmin.from("brevo_metro_lists").insert({
    metro_id: metroId,
    brevo_list_id: String(brevoListId),
    brevo_list_name: listName,
  });

  if (insertError?.code === "23505") {
    const { data: raceExisting } = await supabaseAdmin
      .from("brevo_metro_lists")
      .select("brevo_list_id")
      .eq("metro_id", metroId)
      .maybeSingle();
    if (raceExisting?.brevo_list_id) {
      return { brevo_list_id: raceExisting.brevo_list_id, created: false };
    }
  }
  if (insertError) throw new Error(`Failed to insert mapping: ${insertError.message}`);

  return { brevo_list_id: String(brevoListId), created: true };
}

// deno-lint-ignore no-explicit-any
async function ensureAll(supabaseAdmin: any, apiKey: string): Promise<{ synced: number; created: number; errors: string[] }> {
  const { data: metros, error } = await supabaseAdmin.from("metros").select("id, metro").order("metro");
  if (error) throw new Error(`Failed to fetch metros: ${error.message}`);

  let synced = 0, created = 0;
  const errors: string[] = [];

  // deno-lint-ignore no-explicit-any
  for (const metro of (metros || []) as any[]) {
    try {
      const result = await ensureOne(supabaseAdmin, apiKey, metro.id);
      synced++;
      if (result.created) created++;
    } catch (e: unknown) {
      errors.push(`${metro.metro}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { synced, created, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) return jsonError("BREVO_API_KEY missing", 500);

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) return jsonError("Unauthorized", 401);

    const userId = claims.claims.sub as string;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    // deno-lint-ignore no-explicit-any
    if (roles?.some((r: any) => r.role === "warehouse_manager")) {
      return jsonError("Access denied: warehouse managers cannot access email features", 403);
    }

    const body = await req.json();
    const { action, metro_id } = body;

    if (action === "ensure_one") {
      if (!metro_id) return jsonError("metro_id required");
      const result = await ensureOne(supabaseAdmin, brevoApiKey, metro_id);
      return jsonResponse(result);
    }
    if (action === "ensure_all") {
      const result = await ensureAll(supabaseAdmin, brevoApiKey);
      return jsonResponse(result);
    }
    return jsonError("Invalid action. Use 'ensure_one' or 'ensure_all'");
  } catch (e: unknown) {
    console.error("brevo-metro-lists error:", e);
    return jsonError(e instanceof Error ? e.message : String(e), 500);
  }
});
