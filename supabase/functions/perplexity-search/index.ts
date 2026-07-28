import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ── CORS ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
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

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── System prompts per search type ──
// Base prompts are augmented at runtime with tenant-specific keywords when available.
const SYSTEM_PROMPTS: Record<string, (metro: string | null, tenantKeywords?: string[]) => string> = {
  event: (metro, kw) => {
    const tenantContext = kw?.length ? `\nThis organization focuses on: ${kw.join(", ")}. Prioritize events relevant to these themes.` : "";
    return `You are a research assistant that finds community events, conferences, workshops, trainings, networking events, association meetings, nonprofit gatherings, and professional development opportunities${metro ? ` in or near ${metro}` : ""}.${tenantContext}
Search broadly for ANY events matching the user's query. Include industry association events, professional conferences, community resource fairs, training workshops, webinars, galas, fundraisers, volunteer drives, faith community gatherings, and organizational meetings.
EXCLUDE ONLY: Pure commercial product launches, paid advertising, job postings that are not events.
Return 10-20 results. Each result must include the event name, date if available, location, organizing body, and a URL.
Return results as a JSON object matching the provided schema.`;
  },

  opportunity: (metro, kw) => {
    const tenantContext = kw?.length ? `\nThis organization focuses on: ${kw.join(", ")}. Prioritize organizations relevant to these themes.` : "";
    return `You are a research assistant specializing in nonprofit organizations, ministries, and community partners.
Search for nonprofits, churches, ministries, faith-based organizations, schools, libraries, housing authorities, workforce agencies, government offices, social enterprises, and community organizations${metro ? ` in or near ${metro}` : ""}.${tenantContext}
PRIORITIZE: Organizations focused on community development, digital inclusion, workforce development, education access, refugee/immigrant services, community health, housing, faith-based outreach, ministry programs, social enterprise.
EXCLUDE: For-profit corporations, B2B companies, SaaS vendors.
SEARCH SOURCES: GuideStar/Candid, LinkedIn company pages, government directories, 211 databases, community foundation listings, church/ministry directories, denomination databases.
Return 10-20 results. Each result must include the organization name, mission/description, website URL, and location.
Return results as a JSON object matching the provided schema.`;
  },

  people: (metro, kw) => {
    const tenantContext = kw?.length ? `\nThis organization focuses on: ${kw.join(", ")}. Prioritize contacts relevant to these themes.` : "";
    return `You are a research assistant specializing in finding key contacts at community organizations, nonprofits, and ministries.
Search for executive directors, pastors, ministry leaders, program managers, IT directors, digital equity officers, workforce development coordinators, nonprofit founders, church administrators, and community engagement leaders${metro ? ` in or near ${metro}` : ""}.${tenantContext}
PRIORITIZE: People at nonprofits, churches, ministries, faith-based organizations, libraries, schools, housing authorities, workforce boards, government agencies, social enterprises.
EXCLUDE: Sales representatives, marketing managers at for-profit tech companies.
SEARCH SOURCES: LinkedIn profiles, organization staff pages, church leadership pages, conference speaker lists, government staff directories, denomination directories.
Return 10-15 results. Each result must include the person's name, title, organization, and any available contact information.
Return results as a JSON object matching the provided schema.`;
  },

  grant: (metro, kw) => {
    const tenantContext = kw?.length ? `\nThis organization focuses on: ${kw.join(", ")}. Prioritize grants relevant to these themes.` : "";
    return `You are a research assistant specializing in grant opportunities for nonprofits, ministries, and community development.
Search for federal grants (grants.gov), state technology grants, NTIA broadband/digital equity grants, FCC E-Rate funding, foundation grants for digital inclusion, church/ministry grants, faith-based initiative funding, nonprofit capacity-building grants${metro ? ` relevant to ${metro}` : ""}.${tenantContext}
PRIORITIZE: Active/open grants, federal digital equity programs, BEAD, Digital Equity Act, E-Rate, state broadband offices, community foundations, faith-based initiative grants, ministry development funding, nonprofit startup grants, community bonds, social impact bonds.
EXCLUDE: Expired grants, corporate sponsorships, for-profit accelerator programs, bondage gear, adult entertainment, adult products, or any adult-themed results.
SEARCH SOURCES: grants.gov, NTIA.gov, FCC.gov, state broadband office sites, Foundation Directory Online, community foundation sites, denomination grant programs, faith-based funding directories.
Return 10-15 results. Each result must include the grant name, funder, deadline if available, estimated amount, and application URL.
Return results as a JSON object matching the provided schema.`;
  },
};

// ── JSON schemas per search type ──
const RESULT_SCHEMAS: Record<string, object> = {
  event: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            location: { type: "string" },
            date_info: { type: "string" },
            organization: { type: "string" },
            contact_name: { type: "string" },
            contact_email: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["title"],
        },
      },
      summary: { type: "string" },
      what_we_found: { type: "array", items: { type: "string" } },
      what_may_be_missing: { type: "array", items: { type: "string" } },
      suggested_queries: { type: "array", items: { type: "string" } },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["results", "summary"],
  },
  opportunity: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            location: { type: "string" },
            organization: { type: "string" },
            contact_name: { type: "string" },
            contact_email: { type: "string" },
            contact_phone: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["title"],
        },
      },
      summary: { type: "string" },
      what_we_found: { type: "array", items: { type: "string" } },
      what_may_be_missing: { type: "array", items: { type: "string" } },
      suggested_queries: { type: "array", items: { type: "string" } },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["results", "summary"],
  },
  people: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            organization: { type: "string" },
            contact_name: { type: "string" },
            contact_email: { type: "string" },
            contact_phone: { type: "string" },
            location: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["title"],
        },
      },
      summary: { type: "string" },
      what_we_found: { type: "array", items: { type: "string" } },
      what_may_be_missing: { type: "array", items: { type: "string" } },
      suggested_queries: { type: "array", items: { type: "string" } },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["results", "summary"],
  },
  grant: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            organization: { type: "string" },
            date_info: { type: "string" },
            location: { type: "string" },
            contact_name: { type: "string" },
            contact_email: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["title"],
        },
      },
      summary: { type: "string" },
      what_we_found: { type: "array", items: { type: "string" } },
      what_may_be_missing: { type: "array", items: { type: "string" } },
      suggested_queries: { type: "array", items: { type: "string" } },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["results", "summary"],
  },
};

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  // ── Auth ──
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const enrichSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") ?? "";
  const n8nSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";
  const searchSecret = Deno.env.get("SEARCH_WORKER_SECRET") ?? "";

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    return jsonError(401, "UNAUTHORIZED", "Missing auth token");
  }

  const validSecrets = [serviceRoleKey, enrichSecret, n8nSecret, searchSecret].filter(Boolean);
  const authenticated = validSecrets.some((s) => constantTimeCompare(token, s));
  if (!authenticated) {
    return jsonError(401, "UNAUTHORIZED", "Invalid auth token");
  }

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const run_id = body.run_id as string;
  const raw_query = (body.raw_query || body.query) as string;
  const search_type = body.search_type as string;
  const metro_id = body.metro_id as string | null;
  const tenant_id = body.tenant_id as string | null;
  const max_results = typeof body.max_results === "number" ? body.max_results : 20;

  if (!run_id || !raw_query || !search_type) {
    return jsonError(400, "MISSING_FIELDS", "run_id, query/raw_query, and search_type are required");
  }

  if (!["event", "opportunity", "people", "grant"].includes(search_type)) {
    return jsonError(400, "INVALID_SEARCH_TYPE", "search_type must be event, opportunity, people, or grant");
  }

  // ── Perplexity API key ──
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!perplexityKey) {
    return jsonError(500, "CONFIG_ERROR", "PERPLEXITY_API_KEY not configured");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Resolve metro name ──
  let metroName: string | null = null;
  if (metro_id) {
    try {
      const { data: metro } = await supabase
        .from("metros")
        .select("metro")
        .eq("id", metro_id)
        .single();
      metroName = metro?.metro || null;
    } catch {
      // non-fatal
    }
  }

  // ── Resolve tenant search keywords (skip for gardener / no tenant) ──
  let tenantKeywords: string[] = [];
  let archetypeKey: string | null = null;
  if (tenant_id) {
    try {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("search_keywords, archetype")
        .eq("id", tenant_id)
        .single();
      if (tenant?.search_keywords?.length) {
        tenantKeywords = tenant.search_keywords;
      }
      archetypeKey = tenant?.archetype || null;
    } catch {
      // non-fatal — fall back to generic prompts
    }
  }

  // ── Fetch Communio Resonance snapshots for soft reordering ──
  let resonantKeywords: string[] = [];
  let resonantThemes: string[] = [];
  if (archetypeKey) {
    try {
      const query = supabase
        .from("communio_resonance_snapshots")
        .select("resonant_keywords, testimonium_themes, signal_count")
        .eq("archetype_key", archetypeKey)
        .eq("search_type", search_type)
        .order("computed_at", { ascending: false })
        .limit(5);
      if (metro_id) query.eq("metro_id", metro_id);
      const { data: snaps } = await query;
      if (snaps?.length) {
        const kwSet = new Set<string>();
        const themeSet = new Set<string>();
        for (const s of snaps) {
          for (const kw of (s as any).resonant_keywords || []) kwSet.add(kw);
          for (const t of (s as any).testimonium_themes || []) themeSet.add(t);
        }
        resonantKeywords = [...kwSet].slice(0, 15);
        resonantThemes = [...themeSet].slice(0, 10);
      }
    } catch {
      // non-fatal
    }
  }

  // ── Build Perplexity request ──
  const systemPrompt = SYSTEM_PROMPTS[search_type](metroName, tenantKeywords.length ? tenantKeywords : undefined);
  const userPrompt = metroName
    ? `${raw_query} (Location context: ${metroName}). Find up to ${max_results} results.`
    : `${raw_query}. Find up to ${max_results} results.`;

  const callbackUrl = `${supabaseUrl}/functions/v1/search-callback`;
  let results: Record<string, unknown>[] = [];
  let brief: Record<string, unknown> | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const perplexityResp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 8000,
          search_recency_filter: "year",
          response_format: {
            type: "json_schema",
            json_schema: {
              name: `${search_type}_results`,
              schema: RESULT_SCHEMAS[search_type],
            },
          },
        }),
        signal: controller.signal,
      });

      if (!perplexityResp.ok) {
        const errText = await perplexityResp.text();
        throw new Error(`Perplexity API ${perplexityResp.status}: ${errText.slice(0, 500)}`);
      }

      const data = await perplexityResp.json();
      const content = data.choices?.[0]?.message?.content;
      const citations = data.citations || [];

      if (content) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = { results: [], summary: content.slice(0, 500) };
        }

        const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
        // Build keyword list for matching transparency
        const allKeywords = [...tenantKeywords];
        // Build resonance keywords for soft scoring
        const resKwLower = resonantKeywords.map(k => k.toLowerCase());
        const resThLower = resonantThemes.map(t => t.toLowerCase());

        results = rawResults.map((r: Record<string, unknown>, i: number) => {
          const text = `${r.title || ""} ${r.description || ""}`.toLowerCase();
          const matched = allKeywords.filter((kw) => text.includes(kw.toLowerCase()));

          // Compute resonance score (internal only, 0-1)
          const kwHits = resKwLower.filter(kw => text.includes(kw)).length;
          const thHits = resThLower.filter(t => text.includes(t)).length;
          const resScore = Math.min(
            (resKwLower.length > 0 ? (kwHits / resKwLower.length) * 0.5 : 0) +
            (resThLower.length > 0 ? (thHits / resThLower.length) * 0.5 : 0),
            1
          );

          // Pick calm annotation if above threshold
          const PHRASES = [
            "Quietly resonating across similar missions.",
            "You may find this meaningful.",
            "Others on a similar path noticed this too.",
            "This theme echoes across your community.",
            "A gentle signal from kindred organizations.",
          ];
          const annotation = resScore >= 0.25 ? PHRASES[i % PHRASES.length] : null;

          return {
            title: r.title || `Result ${i + 1}`,
            description: r.description || null,
            url: r.url || (citations[i] ? citations[i] : null),
            source: "perplexity",
            location: r.location || null,
            date_info: r.date_info || null,
            organization: r.organization || null,
            contact_name: r.contact_name || null,
            contact_email: r.contact_email || null,
            contact_phone: r.contact_phone || null,
            confidence: typeof r.confidence === "number" ? r.confidence : null,
            matched_keywords: matched.length > 0 ? matched : undefined,
            resonance_annotation: annotation,
            resonance_score: resScore, // internal — used for soft reorder
            raw_data: r,
          };
        });

        // Soft reorder: results with resonance > 0.1 float up gently
        results.sort((a, b) => {
          const diff = ((b as any).resonance_score || 0) - ((a as any).resonance_score || 0);
          return Math.abs(diff) > 0.1 ? diff : 0;
        });

        brief = {
          summary: (parsed.summary as string) || `Found ${results.length} results via Perplexity sonar-pro`,
          what_we_found: Array.isArray(parsed.what_we_found) ? parsed.what_we_found : results.slice(0, 5).map((r: Record<string, unknown>) => r.title),
          what_may_be_missing: Array.isArray(parsed.what_may_be_missing) ? parsed.what_may_be_missing : [],
          helpful_sites: [],
          suggested_queries: Array.isArray(parsed.suggested_queries) ? parsed.suggested_queries : [],
          confidence: results.length > 5 ? 0.8 : results.length > 0 ? 0.5 : 0.1,
          caveats: Array.isArray(parsed.caveats) ? parsed.caveats : ["Results sourced from Perplexity AI search"],
        };
      }
    } finally {
      clearTimeout(timeout);
    }

    // ── POST results to search-callback ──
    const callbackBody = {
      run_id,
      status: "completed",
      results,
      brief,
    };

    const cbResp = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(callbackBody),
    });

    if (!cbResp.ok) {
      const cbErr = await cbResp.text();
      console.error("Callback failed:", cbErr);
    } else {
      await cbResp.text(); // consume body
    }

    return jsonOk({
      ok: true,
      run_id,
      result_count: results.length,
      source: "perplexity",
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("perplexity-search error:", errMsg);

    // POST failure to callback
    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          run_id,
          status: "failed",
          error_message: errMsg.slice(0, 2000),
        }),
      });
    } catch (cbErr) {
      console.error("Failed to send error callback:", cbErr);
    }

    return jsonError(502, "PERPLEXITY_ERROR", errMsg.slice(0, 500));
  }
});
