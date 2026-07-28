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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) return jsonResponse({ error: "GOOGLE_MAPS_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { placeId, sessionToken } = await req.json();
    if (!placeId) return jsonResponse({ error: "placeId required" }, 400);

    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    url.searchParams.set("fields", "formatted_address,name,address_components,geometry");
    if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      console.error("Places Detail error:", data.status, data.error_message);
      return jsonResponse({ error: data.error_message || data.status }, 500);
    }

    const result = data.result || {};
    return jsonResponse({
      name: result.name,
      formatted_address: result.formatted_address,
      address_components: result.address_components,
      lat: result.geometry?.location?.lat,
      lng: result.geometry?.location?.lng,
    });
  } catch (error) {
    console.error("google-places-detail error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
