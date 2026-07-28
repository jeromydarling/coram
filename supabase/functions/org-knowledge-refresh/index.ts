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

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Search for organization content via Perplexity sonar-pro.
 * Replaces the previous Firecrawl scrape-based approach.
 */
async function perplexityOrgSearch(
  apiKey: string,
  orgName: string,
  websiteUrl: string,
): Promise<{ success: boolean; markdown?: string; citations?: string[] }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const query = `Research the organization "${orgName}" (website: ${websiteUrl}). 
Find detailed information about:
- Their mission statement and core purpose
- Who they serve (target populations/communities)
- Geographic areas they operate in
- Programs and services they offer
- Key statistics and impact numbers
- Leadership and headquarters address
- Partnership opportunities
- Any notable achievements or awards

Focus on their official website content and credible sources. Be thorough and factual.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a research assistant that thoroughly investigates nonprofit organizations, churches, and community organizations. Provide detailed, factual information with specific quotes and data points. Always include the source URLs for your findings.",
          },
          { role: "user", content: query },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        search_domain_filter: [websiteUrl.replace(/^https?:\/\//, "").split("/")[0]],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      console.warn(`Perplexity search failed: ${response.status} ${text}`);
      return { success: false };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    if (!content || content.length < 50) {
      return { success: false };
    }

    return { success: true, markdown: content, citations };
  } catch (err) {
    console.warn(`Perplexity search error:`, err);
    return { success: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let org_id: string | undefined;
  // deno-lint-ignore no-explicit-any
  let supabase: any;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!PERPLEXITY_API_KEY) return jsonError("Perplexity not configured", 500);
    if (!LOVABLE_API_KEY) return jsonError("AI not configured", 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Support service-role calls (from opportunity-auto-enrich) AND user JWT calls
    let userId: string | undefined;
    let isServiceRole = false;

    if (token === SUPABASE_SERVICE_ROLE_KEY) {
      isServiceRole = true;
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      userId = adminRole?.user_id ?? undefined;
    } else {
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      userId = claimsData?.claims?.sub;
      if (claimsError || !userId) return jsonError("Invalid token", 401);
    }

    // ADMIN ONLY
    let isAdmin = isServiceRole;
    if (!isAdmin && userId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      // deno-lint-ignore no-explicit-any
      isAdmin = (roles || []).some((r: any) => r.role === "admin");
    }
    if (!isAdmin) return jsonError("Admin access required", 403);

    const body = await req.json();
    org_id = body.org_id;
    const source_url = body.source_url;
    const force = body.force;

    if (!source_url) return jsonError("source_url required");
    const normalizedUrl = normalizeUrl(source_url);

    // Determine if this org_id belongs to opportunities or operator_opportunities
    let isOperatorOrg = false;
    let orgName = "";

    if (org_id) {
      // First try regular opportunities table
      const { data: regularOrg } = await supabase
        .from("opportunities")
        .select("name")
        .eq("id", org_id)
        .maybeSingle();

      if (regularOrg) {
        orgName = regularOrg.name || "";
      } else {
        // Check operator_opportunities table
        const { data: operatorOrg } = await supabase
          .from("operator_opportunities")
          .select("organization")
          .eq("id", org_id)
          .maybeSingle();

        if (operatorOrg) {
          isOperatorOrg = true;
          orgName = operatorOrg.organization || "";
        }
      }
    }

    // Build the snapshot lookup filter based on org type
    const snapshotFilter = isOperatorOrg
      ? supabase.from("org_knowledge_snapshots").select("id, version").eq("external_org_key", `operator:${org_id}`).eq("active", true).eq("is_authoritative", true)
      : supabase.from("org_knowledge_snapshots").select("id, version").eq("org_id", org_id).eq("active", true).eq("is_authoritative", true);

    // Load current active version
    const { data: current } = await snapshotFilter.maybeSingle();

    const currentVersion = current?.version || 0;

    if (!orgName) {
      // Extract domain as fallback name
      try {
        orgName = new URL(normalizedUrl).hostname.replace("www.", "");
      } catch {
        orgName = normalizedUrl;
      }
    }

    // ── Search via Perplexity ──
    console.log(`Researching org via Perplexity: ${orgName} (${normalizedUrl})`);
    const searchResult = await perplexityOrgSearch(PERPLEXITY_API_KEY, orgName, normalizedUrl);

    if (!searchResult.success || !searchResult.markdown) {
      return jsonError("Could not research the organization from the provided URL", 422);
    }

    const rawExcerpt = searchResult.markdown.substring(0, 50000);
    const citations = searchResult.citations || [];

    // ── Extract structured data via Lovable AI (tool calling) ──
    const extractionPrompt = `You are an expert researcher. Analyze the following research content about "${orgName}" and extract structured information.

RULES:
- Only include facts that are directly supported by the provided content.
- If information is not available, use empty arrays or empty strings. NEVER use placeholder text like "Information not available" or "Not found" — just use "".
- Include direct quotes from the content in the "sources" array.
- approved_claims should be short factual statements directly supported by the content.
- disallowed_claims should list anything uncertain or not clearly supported.
- For headquarters: extract the organization's main office address if mentioned. Parse into city, state, and zip fields. Use US two-letter state codes (e.g. "MN", "OH"). If not found, use empty strings.

Content to analyze:
${rawExcerpt.substring(0, 30000)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a research assistant that extracts structured organizational data." },
          { role: "user", content: extractionPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_org_profile",
              description: "Extract structured organizational profile from research content",
              parameters: {
                type: "object",
                properties: {
                  org_name: { type: "string" },
                  mission: { type: "string" },
                  positioning: { type: "string" },
                  who_we_serve: { type: "array", items: { type: "string" } },
                  geographies: { type: "array", items: { type: "string" } },
                  programs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { name: { type: "string" }, summary: { type: "string" } },
                      required: ["name", "summary"],
                    },
                  },
                  key_stats: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { label: { type: "string" }, value: { type: "string" } },
                      required: ["label", "value"],
                    },
                  },
                  tone_keywords: { type: "array", items: { type: "string" } },
                  approved_claims: { type: "array", items: { type: "string" } },
                  disallowed_claims: { type: "array", items: { type: "string" } },
                  partnership_angles: { type: "array", items: { type: "string" } },
                  sources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { url: { type: "string" }, quote: { type: "string" } },
                      required: ["url", "quote"],
                    },
                  },
                  headquarters: {
                    type: "object",
                    description: "Main office / headquarters address if found",
                    properties: {
                      address_line1: { type: "string", description: "Street address" },
                      city: { type: "string", description: "City name" },
                      state: { type: "string", description: "US two-letter state code (e.g. MN, OH)" },
                      zip: { type: "string", description: "ZIP code" },
                    },
                    required: ["city", "state", "zip"],
                  },
                },
                required: ["org_name", "mission", "positioning", "who_we_serve", "geographies", "programs", "key_stats", "tone_keywords", "approved_claims", "disallowed_claims", "partnership_angles", "sources"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_org_profile" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI extraction failed:", aiResponse.status, errText);
      if (aiResponse.status === 429) return jsonError("AI rate limit exceeded, try again later", 429);
      if (aiResponse.status === 402) return jsonError("AI credits exhausted", 402);
      return jsonError("AI extraction failed", 500);
    }

    const aiData = await aiResponse.json();
    let structuredJson: Record<string, unknown> = {};

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        structuredJson = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr);
      structuredJson = {
        org_name: "Unknown", mission: "Extraction failed",
        positioning: "", who_we_serve: [], geographies: [], programs: [],
        key_stats: [], tone_keywords: [], approved_claims: [], disallowed_claims: [],
        partnership_angles: [], sources: [],
      };
    }

    const contentHash = simpleHash(normalizedUrl + JSON.stringify(structuredJson));
    const newVersion = currentVersion + 1;

    // Deactivate previous BEFORE inserting new
    if (current) {
      await supabase
        .from("org_knowledge_snapshots")
        .update({ active: false })
        .eq("id", current.id);
    }

    // Insert new snapshot — use external_org_key for operator orgs to avoid FK violation
    const insertPayload: Record<string, unknown> = {
      source_url: normalizedUrl,
      captured_at: new Date().toISOString(),
      model: "google/gemini-3-flash-preview",
      content_hash: contentHash,
      raw_excerpt: rawExcerpt,
      structured_json: structuredJson,
      created_by: userId,
      version: newVersion,
      source_type: "perplexity_research",
      is_authoritative: true,
      active: true,
    };

    if (isOperatorOrg) {
      insertPayload.org_id = null;
      insertPayload.external_org_key = `operator:${org_id}`;
    } else {
      insertPayload.org_id = org_id || null;
      insertPayload.external_org_key = org_id ? null : normalizedUrl;
    }

    const { data: snapshot, error: snapErr } = await supabase
      .from("org_knowledge_snapshots")
      .insert(insertPayload)
      .select("id, version")
      .single();

    if (snapErr || !snapshot) {
      console.error("Snapshot insert failed:", snapErr);
      return jsonError("Failed to store snapshot", 500);
    }

    // Update replaced_by on old snapshot
    if (current) {
      await supabase
        .from("org_knowledge_snapshots")
        .update({ replaced_by: snapshot.id })
        .eq("id", current.id);
    }

    // Insert sources from Perplexity citations
    const sourceRows = citations.map((url: string) => ({
      snapshot_id: snapshot.id,
      url,
      title: null,
      snippet: null,
      content_hash: simpleHash(url),
    }));

    // Also add the main URL as a source
    sourceRows.unshift({
      snapshot_id: snapshot.id,
      url: normalizedUrl,
      title: orgName,
      snippet: rawExcerpt.substring(0, 500),
      content_hash: simpleHash(normalizedUrl),
    });

    await supabase.from("org_knowledge_sources").insert(sourceRows);

    // ── Backfill opportunity location from extracted headquarters ──
    if (org_id) {
      const hq = structuredJson.headquarters as { address_line1?: string; city?: string; state?: string; zip?: string } | undefined;
      if (hq && (hq.city || hq.zip)) {
        const { data: currentOrg } = await supabase
          .from("opportunities")
          .select("city, state, state_code, zip, address_line1")
          .eq("id", org_id)
          .maybeSingle();

        if (currentOrg) {
          const isGarbage = (v: string | null | undefined) => !v || /^(information not available|not found|n\/a|unknown)$/i.test(v.trim());
          const isUsable = (v: string | null | undefined): v is string => !!v && !isGarbage(v);
          const updates: Record<string, string> = {};
          if (isGarbage(currentOrg.city) && isUsable(hq.city)) updates.city = hq.city;
          if (isGarbage(currentOrg.state) && isUsable(hq.state)) updates.state = hq.state;
          if (isGarbage(currentOrg.state_code) && isUsable(hq.state)) updates.state_code = hq.state;
          if (isGarbage(currentOrg.zip) && isUsable(hq.zip)) updates.zip = hq.zip;
          if (isGarbage(currentOrg.address_line1) && isUsable(hq.address_line1)) updates.address_line1 = hq.address_line1;

          if (Object.keys(updates).length > 0) {
            const { error: locErr } = await supabase
              .from("opportunities")
              .update(updates)
              .eq("id", org_id);
            if (locErr) {
              console.warn("Location backfill failed:", locErr.message);
            } else {
              console.log(`Backfilled location for org ${org_id}: ${JSON.stringify(updates)}`);
            }
          }
        }
      }
    }

    // ── Update opportunity org_knowledge_status ──
    if (org_id) {
      try {
        await supabase
          .from("opportunities")
          .update({ org_knowledge_status: "completed" })
          .eq("id", org_id);
      } catch { /* best-effort */ }
    }

    return jsonResponse({
      ok: true,
      snapshot_id: snapshot.id,
      version: snapshot.version,
      structured_json: structuredJson,
      sources_count: sourceRows.length,
      engine: "perplexity",
    });
  } catch (error) {
    console.error("org-knowledge-refresh error:", error);

    // Mark org_knowledge_status as failed on error
    if (org_id && supabase) {
      try {
        await supabase
          .from("opportunities")
          .update({ org_knowledge_status: "failed" })
          .eq("id", org_id);
      } catch { /* best-effort */ }
    }

    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
