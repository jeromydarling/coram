import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { normalizeState, buildDeterministicSourceUrls, deriveLocationKey } from "../_shared/stateFips.ts";
import { emitUsageEvents, type UsageEvent } from "../_shared/usageEvents.ts";
import { getOrgKnowledgeContext, buildOrgKnowledgeSystemBlock } from "../_shared/orgKnowledgeContext.ts";
import { checkDeepAllowance, recordWorkflowUsage } from "../_shared/intelligenceGovernance.ts";

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

// ── Census Geocoder ──
interface GeoResult {
  lat: number;
  lng: number;
  tractFips: string;
  countyFips: string;
  stateFips: string;
  matchedAddress: string;
}

async function geocodeAddress(
  street: string,
  city: string,
  state: string,
  zip: string,
): Promise<GeoResult | null> {
  try {
    const params = new URLSearchParams({
      street,
      city,
      state,
      zip,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json",
    });
    const resp = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/address?${params}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!resp.ok) { await resp.text(); return null; }
    const data = await resp.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;
    const geo = match.geographies?.["Census Tracts"]?.[0];
    if (!geo) return null;
    return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      tractFips: geo.TRACT,
      countyFips: geo.COUNTY,
      stateFips: geo.STATE,
      matchedAddress: match.matchedAddress || "",
    };
  } catch {
    return null;
  }
}

// ── ACS 5-Year Estimates for a census tract ──
async function fetchTractACS(
  stateFips: string,
  countyFips: string,
  tractFips: string,
): Promise<Record<string, string> | null> {
  try {
    const vars = [
      "NAME",
      "B01001_001E", // total population
      "B01002_001E", // median age
      "B19013_001E", // median household income
      "B17001_002E", // population below poverty
      "B17001_001E", // total pop for poverty denominator
      "B25077_001E", // median home value
      "B25064_001E", // median gross rent
      "B28002_004E", // broadband subscribers
      "B28002_001E", // total households for internet
      "B15003_022E", // bachelor's degree holders
      "B15003_001E", // total 25+ for education
      "B03002_012E", // Hispanic/Latino population
      "B03002_001E", // total for race/ethnicity
      "B02001_003E", // Black/African American
    ].join(",");

    const resp = await fetch(
      `https://api.census.gov/data/2022/acs/acs5?get=${vars}&for=tract:${tractFips}&in=state:${stateFips}+county:${countyFips}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!resp.ok) { await resp.text(); return null; }
    const data = await resp.json();
    if (!data || data.length < 2) return null;

    const headers = data[0] as string[];
    const values = data[1] as string[];
    const result: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      result[h] = values[i];
    });
    return result;
  } catch {
    return null;
  }
}

function formatACSContext(acs: Record<string, string>): string {
  const num = (k: string) => parseInt(acs[k]) || 0;
  const flt = (k: string) => parseFloat(acs[k]) || 0;
  const pct = (numKey: string, denKey: string) => {
    const d = num(denKey);
    return d > 0 ? ((num(numKey) / d) * 100).toFixed(1) : "N/A";
  };

  const pop = num("B01001_001E");
  const medianAge = flt("B01002_001E");
  const medianIncome = num("B19013_001E");
  const povertyRate = pct("B17001_002E", "B17001_001E");
  const medianHomeValue = num("B25077_001E");
  const medianRent = num("B25064_001E");
  const broadbandRate = pct("B28002_004E", "B28002_001E");
  const bachelorRate = pct("B15003_022E", "B15003_001E");
  const hispanicRate = pct("B03002_012E", "B03002_001E");
  const blackRate = pct("B02001_003E", "B03002_001E");
  const tractName = acs["NAME"] || "Unknown tract";

  return `=== CENSUS TRACT DATA (${tractName}) ===
Source: American Community Survey 5-Year Estimates (2022)
This data represents the SPECIFIC NEIGHBORHOOD (census tract), NOT the entire city.

Population: ${pop.toLocaleString()}
Median Age: ${medianAge}
Median Household Income: $${medianIncome.toLocaleString()}
Poverty Rate: ${povertyRate}%
Median Home Value: $${medianHomeValue.toLocaleString()}
Median Gross Rent: $${medianRent.toLocaleString()}
Broadband Internet Access: ${broadbandRate}%
Bachelor's Degree Rate: ${bachelorRate}%
Hispanic/Latino Population: ${hispanicRate}%
Black/African American Population: ${blackRate}%`;
}

// ── Perplexity neighborhood research ──
async function perplexityNeighborhoodResearch(
  query: string,
  apiKey: string,
): Promise<{ content: string; citations: string[] }> {
  try {
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a community research assistant. Provide detailed, factual information about neighborhoods, demographics, community organizations, and local needs. Include specific data points when available." },
          { role: "user", content: query },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.error(`Perplexity search error: ${resp.status}`);
      return { content: "", citations: [] };
    }
    const data = await resp.json();
    return {
      content: data?.choices?.[0]?.message?.content || "",
      citations: data?.citations || [],
    };
  } catch (e) {
    console.error("Perplexity neighborhood research failed:", e);
    return { content: "", citations: [] };
  }
}

// ── SHA-256 helper ──
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  const correlationId = crypto.randomUUID().slice(0, 8);

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Missing auth token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonError(401, "UNAUTHORIZED", "Invalid token");
  }

  const userId = claimsData.claims.sub as string;

  // ── Parse body ──
  let body: { org_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  if (!body.org_id || typeof body.org_id !== "string") {
    return jsonError(400, "MISSING_FIELD", "org_id is required");
  }

  const orgId = body.org_id;
  const force = body.force === true;

  console.log(`[${correlationId}] neighborhood-insights for org ${orgId}, force=${force}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── Resolve tenant for governance ──
    const { data: tenantLink } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    const tenantId = tenantLink?.tenant_id;

    // ── Deep Intelligence governance check ──
    let governanceDegraded = false;
    if (tenantId) {
      const govResult = await checkDeepAllowance(supabase, tenantId, 'neighborhood_insights');
      if (govResult.degraded) {
        governanceDegraded = true;
        console.log(`[${correlationId}] governance: degraded to essential mode (${govResult.deepUsed}/${govResult.deepAllowance} deep used)`);
      } else if (govResult.mode === 'deep') {
        console.log(`[${correlationId}] governance: deep mode allowed (${govResult.deepUsed}/${govResult.deepAllowance})`);
      }
    }

    // ── Load org ──
    const { data: org, error: orgErr } = await supabase
      .from("opportunities")
      .select("id, organization, city, state, state_code, state_fips, county, county_fips, place_fips, zip, address_line1, website_url")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr) throw new Error(`org fetch failed: ${orgErr.message}`);
    if (!org) return jsonError(404, "NOT_FOUND", "Organization not found");

    // ── Require org knowledge ──
    const orgKnowledge = await getOrgKnowledgeContext(supabase, orgId);
    if (!orgKnowledge) {
      return jsonError(400, "ORG_KNOWLEDGE_REQUIRED", "Organization Knowledge must be generated before Neighborhood Insights can be created");
    }

    console.log(`[${correlationId}] org knowledge v${orgKnowledge.version} loaded`);

    // ── Sanitize garbage placeholders ──
    const garbageRe = /^(information not available|not found|n\/a|unknown)$/i;
    const clean = (v: string | null | undefined): string | null =>
      v && !garbageRe.test(v.trim()) ? v.trim() : null;

    // ── Merge org knowledge HQ as authoritative fallback for location ──
    // Org knowledge headquarters is often more accurate (user-corrected),
    // so prefer it over stale opportunity row values.
    const hq = (orgKnowledge.structured_json as Record<string, unknown>)?.headquarters as
      | { address_line1?: string; city?: string; state?: string; zip?: string }
      | undefined;

    const cleanOrg = {
      ...org,
      city: clean(hq?.city) || clean(org.city),
      state: clean(hq?.state) || clean(org.state),
      state_code: clean(org.state_code),
      zip: clean(hq?.zip) || clean(org.zip),
      address_line1: clean(hq?.address_line1) || clean(org.address_line1),
    };

    // ── Derive location key ──
    const locationKey = deriveLocationKey(cleanOrg);
    if (!locationKey) {
      return jsonError(400, "INSUFFICIENT_LOCATION", "Organization needs at least zip OR city+state to generate insights");
    }

    // ── Cache check ──
    if (!force) {
      const { data: cached } = await supabase
        .from("org_neighborhood_insights")
        .select("id, summary, insights_json, generated_at, fresh_until, model, location_key")
        .eq("org_id", orgId)
        .eq("location_key", locationKey)
        .maybeSingle();

      if (cached && new Date(cached.fresh_until) > new Date()) {
        console.log(`[${correlationId}] cache hit, fresh until ${cached.fresh_until}`);
        const { data: sources } = await supabase
          .from("org_neighborhood_insight_sources")
          .select("url, title, snippet, content_hash")
          .eq("insight_id", cached.id);

        return jsonOk({
          ok: true,
          cached: true,
          insight: {
            id: cached.id,
            location_key: cached.location_key,
            summary: cached.summary,
            insights_json: cached.insights_json,
            generated_at: cached.generated_at,
            fresh_until: cached.fresh_until,
            model: cached.model,
            sources: sources || [],
          },
        });
      }
    }

    // ── Rate limiting: 10/day/user ──
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("org_neighborhood_insights")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .gte("created_at", todayStart.toISOString());

    if ((todayCount ?? 0) >= 10) {
      return jsonError(429, "RATE_LIMITED", "Daily insight generation limit reached (10/day)");
    }

    // ── Perplexity key ──
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!perplexityKey) {
      return jsonError(500, "CONFIG_ERROR", "Perplexity API key not configured");
    }

    const stateInfo = normalizeState(org.state);
    const stateLabel = stateInfo?.stateName || cleanOrg.state || "";
    const cityLabel = cleanOrg.city || "";
    const zipLabel = cleanOrg.zip || "";
    const locationLabel = [cityLabel, stateLabel, zipLabel].filter(Boolean).join(", ");

    // ═══════════════════════════════════════════════════════
    // STEP 1: Geocode + ACS (tract-level demographics)
    // ═══════════════════════════════════════════════════════
    let geoResult: GeoResult | null = null;
    let acsContext = "";

    if (cleanOrg.address_line1 && cleanOrg.city && (cleanOrg.state || cleanOrg.state_code)) {
      console.log(`[${correlationId}] geocoding: ${cleanOrg.address_line1}, ${cleanOrg.city}, ${cleanOrg.state}`);
      geoResult = await geocodeAddress(
        cleanOrg.address_line1,
        cleanOrg.city,
        cleanOrg.state || cleanOrg.state_code || "",
        cleanOrg.zip || "",
      );

      if (geoResult) {
        console.log(`[${correlationId}] geocoded → tract ${geoResult.stateFips}${geoResult.countyFips}${geoResult.tractFips}`);
        const acsData = await fetchTractACS(geoResult.stateFips, geoResult.countyFips, geoResult.tractFips);
        if (acsData) {
          acsContext = formatACSContext(acsData);
          console.log(`[${correlationId}] ACS data loaded for tract`);
        } else {
          console.log(`[${correlationId}] ACS data not available for tract`);
        }
      } else {
        console.log(`[${correlationId}] geocoding failed, falling back to city-level`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Neighborhood research via Perplexity
    // (Skipped in degraded/essential mode — no external research)
    // ═══════════════════════════════════════════════════════
    const neighborhoodTerm = zipLabel ? `${zipLabel} ${cityLabel}` : `${cityLabel} ${stateLabel}`;

    const allCitations: string[] = [];
    const researchContent: string[] = [];
    const seenUrls = new Set<string>();
    const scrapedSources: Array<{ url: string; title: string; markdown: string; contentHash: string }> = [];

    if (governanceDegraded) {
      console.log(`[${correlationId}] skipping Perplexity research (essential mode — Deep allowance exhausted)`);
    } else {
      const researchQueries = [
        `What is the history, demographics, and community character of the neighborhood around ${neighborhoodTerm}? Include population, income levels, education, broadband access, and key community organizations.`,
        `What are the current community needs, challenges, and nonprofit organizations serving ${neighborhoodTerm}? Focus on social services, digital inclusion, workforce development, and community development.`,
      ];

      console.log(`[${correlationId}] running ${researchQueries.length} Perplexity neighborhood research queries`);

      const researchPromises = researchQueries.map((q) => perplexityNeighborhoodResearch(q, perplexityKey));
      const researchResults = await Promise.all(researchPromises);

      for (const result of researchResults) {
        if (result.content) researchContent.push(result.content);
        allCitations.push(...result.citations);
      }

      for (const citation of allCitations) {
        const canon = citation.replace(/\/$/, "").toLowerCase();
        if (!seenUrls.has(canon)) {
          seenUrls.add(canon);
          const hash = await sha256(citation);
          scrapedSources.push({
            url: citation,
            title: citation.split("/").pop() || citation,
            markdown: "",
            contentHash: hash,
          });
        }
      }

      console.log(`[${correlationId}] Perplexity returned ${researchContent.length} research blocks, ${scrapedSources.length} citations`);
    }

    const hasExternalSources = researchContent.length > 0;
    const hasACS = acsContext.length > 0;

    // ═══════════════════════════════════════════════════════
    // STEP 4: Build LLM prompt with neighborhood context
    // ═══════════════════════════════════════════════════════
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return jsonError(500, "CONFIG_ERROR", "AI service not configured");
    }

    const orgKnowledgeBlock = buildOrgKnowledgeSystemBlock(orgKnowledge);

    const sourceContext = hasExternalSources
      ? researchContent.map((c, i) => `--- Research Block ${i + 1} ---\n${c.slice(0, 4000)}`).join("\n\n")
      : "";

    // Citation context
    const snippetContext = scrapedSources.length > 0
      ? scrapedSources.map((s) => `• ${s.url}`).join("\n")
      : "";

    const addressLine = cleanOrg.address_line1 ? `at ${cleanOrg.address_line1}, ` : "";
    const radiusNote = geoResult
      ? `Census tract ${geoResult.stateFips}${geoResult.countyFips}${geoResult.tractFips} (matched address: ${geoResult.matchedAddress})`
      : `ZIP code ${zipLabel || "unknown"}`;

    const dataAvailability = [];
    if (hasACS) dataAvailability.push("Census tract-level demographic data (ACS 2022)");
    if (hasExternalSources) dataAvailability.push(`${researchContent.length} Perplexity research blocks with ${scrapedSources.length} citations`);
    if (snippetContext) dataAvailability.push(`${scrapedSources.length} cited source URLs`);
    if (!hasACS && !hasExternalSources) dataAvailability.push("Organization knowledge only (no external data available)");

    const systemPrompt = `You are an expert community analyst specializing in NEIGHBORHOOD-LEVEL analysis. Generate a structured neighborhood insight report for "${org.organization}" located ${addressLine}${locationLabel}.

CRITICAL SCOPE: Analyze the SPECIFIC NEIGHBORHOOD around this address (~10 mile radius), NOT the entire city of ${cityLabel}. The target area is ${radiusNote}.

Available data: ${dataAvailability.join("; ")}

${hasACS ? acsContext : "Census tract-level demographic data was not available. Do NOT fabricate statistics."}

${orgKnowledgeBlock}

${snippetContext ? `=== SEARCH SNIPPETS ===\n${snippetContext}` : ""}

Use the organization profile to focus analysis on community needs, trends, and opportunities RELEVANT to this organization's mission and the populations they serve. Prioritize insights that inform partnership strategy.

CRITICAL RULES:
- Focus on the NEIGHBORHOOD, not the city. ${hasACS ? "Use the census tract data for demographics — these numbers represent THIS neighborhood specifically." : ""}
- ${hasExternalSources ? "Use the provided research material for claims. Cross-reference with census data when available. Do NOT fabricate facts." : "No web research data was available. Base analysis on census data and organization knowledge. Clearly note limited external data."}
- helpful_articles URLs MUST come from provided source URLs only (leave empty if none)
- sources must include actual quotes from source material (leave empty if none available)
- Be specific about THIS neighborhood's character, challenges, and opportunities
- Frame community needs through the lens of what this specific organization does
- ${hasACS ? "Reference specific census data points (income, poverty rate, broadband access, etc.) in your analysis" : "Do NOT invent demographic statistics"}

Return valid JSON matching this schema exactly:
{
  "location_label": "string (neighborhood name + city, NOT just city)",
  "brief_history": "string (2-3 sentences about THIS neighborhood)",
  "current_trends": ["string"],
  "current_struggles": ["string"],
  "community_needs": ["string"],
  "program_opportunities": ["string"],
  "helpful_articles": [{"title": "string", "url": "string", "why": "string"}],
  "sources": [{"title": "string", "url": "string", "quote": "string"}],
  "demographics_summary": "string (1-2 sentences summarizing key tract-level demographics)"
}`;

    const userPrompt = hasExternalSources
      ? `Generate the neighborhood insight report based on this research:\n\n${sourceContext}`
      : hasACS
        ? `Generate the neighborhood insight report based on the census tract data and organization knowledge provided. No web research was available.`
        : `Generate the neighborhood insight report based solely on the organization knowledge profile. No external sources or census data were available.`;

    const model = "google/gemini-2.5-flash";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[${correlationId}] LLM error: ${aiResp.status} ${errText}`);
      return jsonError(502, "LLM_ERROR", "AI service returned an error");
    }

    const aiData = await aiResp.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "{}";
    const usageTokens = aiData?.usage || {};

    let insightsJson: Record<string, unknown>;
    try {
      insightsJson = JSON.parse(rawContent);
    } catch {
      console.error(`[${correlationId}] LLM returned invalid JSON`);
      return jsonError(502, "LLM_PARSE_ERROR", "AI returned unparseable response");
    }

    // Validate articles ⊆ scraped sources
    if (hasExternalSources) {
      const fetchedUrls = new Set(scrapedSources.map((s) => s.url));
      const articles = (insightsJson.helpful_articles as Array<{ url: string }>) || [];
      insightsJson.helpful_articles = articles.filter((a) => fetchedUrls.has(a.url));
    } else {
      insightsJson.helpful_articles = [];
      insightsJson.sources = [];
    }

    // Build summary with neighborhood focus
    const summaryParts: string[] = [];
    if (insightsJson.demographics_summary) summaryParts.push(`📊 ${insightsJson.demographics_summary}`);
    if (insightsJson.brief_history) summaryParts.push(`📍 ${insightsJson.brief_history}`);
    const trends = (insightsJson.current_trends as string[]) || [];
    trends.slice(0, 2).forEach((t) => summaryParts.push(`📈 ${t}`));
    const struggles = (insightsJson.current_struggles as string[]) || [];
    struggles.slice(0, 2).forEach((s) => summaryParts.push(`⚠️ ${s}`));
    const needs = (insightsJson.community_needs as string[]) || [];
    needs.slice(0, 2).forEach((n) => summaryParts.push(`🎯 ${n}`));
    const opps = (insightsJson.program_opportunities as string[]) || [];
    opps.slice(0, 2).forEach((o) => summaryParts.push(`💡 ${o}`));
    const summary = summaryParts.slice(0, 10).join("\n");

    const contentHash = await sha256(JSON.stringify(insightsJson));
    const freshUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── Upsert insight ──
    const { data: insight, error: insightErr } = await supabase
      .from("org_neighborhood_insights")
      .upsert(
        {
          org_id: orgId,
          location_key: locationKey,
          generated_at: new Date().toISOString(),
          fresh_until: freshUntil,
          model,
          summary,
          insights_json: insightsJson,
          content_hash: contentHash,
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,location_key" },
      )
      .select("id")
      .single();

    if (insightErr) throw new Error(`insight upsert failed: ${insightErr.message}`);

    // ── Insert sources ──
    await supabase
      .from("org_neighborhood_insight_sources")
      .delete()
      .eq("insight_id", insight.id);

    const sourceRows = scrapedSources.map((s) => ({
      insight_id: insight.id,
      url: s.url,
      title: s.title,
      snippet: s.markdown.slice(0, 500),
      content_hash: s.contentHash,
    }));

    if (sourceRows.length > 0) {
      const { error: srcErr } = await supabase
        .from("org_neighborhood_insight_sources")
        .insert(sourceRows);
      if (srcErr) console.error(`[${correlationId}] source insert error: ${srcErr.message}`);
    }

    // ── Usage metering ──
    const perplexityQueryCount = governanceDegraded ? 0 : 2;
    const usageEvents: UsageEvent[] = [
      { workflow_key: "neighborhood_insights", run_id: correlationId, event_type: "neighborhood_insights_generated", unit: "count" },
    ];
    if (perplexityQueryCount > 0) {
      usageEvents.push({ workflow_key: "neighborhood_insights", run_id: correlationId, event_type: "perplexity_searches", quantity: perplexityQueryCount, unit: "perplexity_search" });
    }
    if (usageTokens.prompt_tokens) {
      usageEvents.push({ workflow_key: "neighborhood_insights", run_id: correlationId, event_type: "llm_tokens_in", quantity: usageTokens.prompt_tokens, unit: "token" });
    }
    if (usageTokens.completion_tokens) {
      usageEvents.push({ workflow_key: "neighborhood_insights", run_id: correlationId, event_type: "llm_tokens_out", quantity: usageTokens.completion_tokens, unit: "token" });
    }
    await emitUsageEvents(supabase, usageEvents);

    // ── Record governance usage ──
    if (tenantId) {
      const mode = governanceDegraded ? 'essential' : 'deep';
      const totalTokens = (usageTokens.prompt_tokens || 0) + (usageTokens.completion_tokens || 0);
      recordWorkflowUsage(
        supabase, tenantId, 'neighborhood_insights',
        governanceDegraded ? 'lovable' : 'perplexity',
        mode, totalTokens,
      ).catch(e => console.warn(`[${correlationId}] governance usage recording failed:`, e));
    }

    console.log(`[${correlationId}] neighborhood insight generated: ${scrapedSources.length} sources, ACS=${hasACS}, geo=${!!geoResult}`);

    // ── Update opportunity neighborhood_status ──
    try {
      await supabase
        .from("opportunities")
        .update({ neighborhood_status: "completed" })
        .eq("id", orgId);
    } catch { /* best-effort */ }

    return jsonOk({
      ok: true,
      cached: false,
      insight: {
        id: insight.id,
        location_key: locationKey,
        summary,
        insights_json: insightsJson,
        generated_at: new Date().toISOString(),
        fresh_until: freshUntil,
        model,
        state_fips: geoResult?.stateFips || stateInfo?.stateFips || org.state_fips || null,
        sources: sourceRows.map((s) => ({ url: s.url, title: s.title, snippet: s.snippet, content_hash: s.content_hash })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${correlationId}] error: ${message}`);

    // ── Mark neighborhood_status as failed on error ──
    try {
      await supabase
        .from("opportunities")
        .update({ neighborhood_status: "failed" })
        .eq("id", orgId);
    } catch { /* best-effort */ }

    return jsonError(500, "PROCESSING_ERROR", message);
  }
});
