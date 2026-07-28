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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonError("LOVABLE_API_KEY not configured", 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return jsonError("Invalid token", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ADMIN ONLY
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // deno-lint-ignore no-explicit-any
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return jsonError("Admin access required", 403);

    const body = await req.json();
    const { org_id, org_name, website_url } = body;

    if (!org_id || !org_name) return jsonError("org_id and org_name required");

    const prompt = `Find the headquarters/main office physical address for the organization "${org_name}"${website_url ? ` (website: ${website_url})` : ''}.

Return ONLY the address in structured format. If you cannot determine the address with confidence, return empty strings.
Do NOT guess or fabricate addresses. Only return an address you are confident about.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a research assistant that finds organization headquarters addresses. Only return addresses you are confident about." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_address",
              description: "Return the structured headquarters address",
              parameters: {
                type: "object",
                properties: {
                  address_line1: { type: "string", description: "Street address (e.g. '123 Main St')" },
                  city: { type: "string", description: "City name" },
                  state: { type: "string", description: "US two-letter state code (e.g. MN, OH)" },
                  zip: { type: "string", description: "ZIP code" },
                  confidence: { type: "string", enum: ["high", "medium", "low"], description: "How confident you are this is correct" },
                },
                required: ["address_line1", "city", "state", "zip", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_address" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI lookup failed:", aiResponse.status, errText);
      if (aiResponse.status === 429) return jsonError("Rate limit exceeded, try again later", 429);
      if (aiResponse.status === 402) return jsonError("AI credits exhausted", 402);
      return jsonError("AI lookup failed", 500);
    }

    const aiData = await aiResponse.json();
    let address: Record<string, string> = {};

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        address = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr);
      return jsonError("Failed to parse address from AI", 500);
    }

    const confidence = address.confidence || "low";
    delete address.confidence;

    if (!address.city && !address.zip) {
      return jsonResponse({ ok: true, found: false, message: "Could not find a confident address for this organization." });
    }

    return jsonResponse({
      ok: true,
      found: true,
      confidence,
      headquarters: {
        address_line1: address.address_line1 || "",
        city: address.city || "",
        state: address.state || "",
        zip: address.zip || "",
      },
    });
  } catch (error) {
    console.error("org-knowledge-find-address error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
