/**
 * tenant-enrich-org — Researches a URL or reads a PDF and extracts org identity for onboarding.
 *
 * WHAT: Takes a website/social URL or a PDF storage path, extracts org data with AI.
 * WHERE: Called during onboarding org enrichment step.
 * WHY: Seeds tenant_public_profiles with mission language, programs, and identity.
 *
 * ENGINE: Uses Perplexity (sonar-pro) for URL research, Lovable AI for PDF extraction.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }
  const token = authHeader.slice(7).trim();

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonError(401, "unauthorized", "Invalid token");
  }

  const body = await req.json();
  const { tenant_id, url, pdf_storage_path } = body as {
    tenant_id: string;
    url?: string;
    pdf_storage_path?: string;
  };

  if (!tenant_id || (!url && !pdf_storage_path)) {
    return jsonError(400, "bad_request", "tenant_id and either url or pdf_storage_path are required");
  }

  const svc = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify user belongs to this tenant
  const { data: membership } = await svc
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenant_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return jsonError(403, "forbidden", "Not a member of this tenant");
  }

  try {
    let scrapedContent = "";
    let logoUrl: string | null = null;
    let sourceType = "website";
    let coverage = "full";
    let sourceRef = url || pdf_storage_path || "";

    // ── PDF path ──
    if (pdf_storage_path) {
      sourceType = "pdf";
      coverage = "partial";

      // Download PDF from storage
      const { data: signedUrlData, error: signedErr } = await svc.storage
        .from("kb-uploads")
        .createSignedUrl(pdf_storage_path, 300);

      if (signedErr || !signedUrlData?.signedUrl) {
        console.error("Storage signed URL error:", signedErr);
        return jsonError(500, "storage_error", "Could not access uploaded PDF");
      }

      const pdfResp = await fetch(signedUrlData.signedUrl);
      if (!pdfResp.ok) {
        return jsonError(500, "storage_error", "Could not download PDF");
      }

      const pdfBuffer = await pdfResp.arrayBuffer();
      const bytes = new Uint8Array(pdfBuffer);

      // Enforce 5 MB limit
      if (bytes.length > 5 * 1024 * 1024) {
        return jsonError(413, "file_too_large", "PDF must be under 5 MB");
      }

      // Chunked base64 encoding (stack-safe)
      const chunkSize = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      const base64Pdf = btoa(binary);

      // Use AI with PDF data URI
      const aiResp = await fetch(
        `${supabaseUrl}/functions/v1/ai-proxy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: AI_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:application/pdf;base64,${base64Pdf}`,
                    },
                  },
                  {
                    type: "text",
                    text: "Extract organization identity from this PDF document.",
                  },
                ],
              },
            ],
          }),
        }
      );

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const content =
          aiData.choices?.[0]?.message?.content || aiData.content || "";
        const parsed = parseAiJson(content);
        if (parsed) {
          const profile = buildProfile(parsed, logoUrl);
          await upsertProfile(svc, tenant_id, {
            ...profile,
            source_url: `pdf:${pdf_storage_path}`,
            enrichment_source: "pdf",
            enrichment_coverage: coverage,
          });
          return jsonOk({ ok: true, profile, coverage, source_type: "pdf" });
        }
      } else {
        console.error("AI proxy error for PDF:", await aiResp.text());
      }

      // Fallback: minimal profile
      await upsertProfile(svc, tenant_id, {
        source_url: `pdf:${pdf_storage_path}`,
        enrichment_source: "pdf",
        enrichment_coverage: "partial",
      });
      return jsonOk({ ok: true, profile: {}, coverage: "partial", source_type: "pdf" });
    }

    // ── URL path ──
    sourceType = detectSourceType(url!);
    coverage = sourceType === "website" ? "full" : "partial";

    if (perplexityKey) {
      try {
        let formattedUrl = url!.trim();
        if (
          !formattedUrl.startsWith("http://") &&
          !formattedUrl.startsWith("https://")
        ) {
          formattedUrl = `https://${formattedUrl}`;
        }

        // Use Perplexity to research the organization via its URL
        const researchResp = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${perplexityKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              { role: "system", content: "You are a nonprofit research assistant. Research the organization at the given URL and provide detailed information about their mission, programs, leadership, and community served." },
              { role: "user", content: `Research the organization at ${formattedUrl}. Provide their full name, tagline/motto, mission description (2-3 sentences), city, state, metro area, programs they run, populations they serve, and relevant keywords for their work.` },
            ],
            max_tokens: 2000,
            temperature: 0.2,
            search_domain_filter: [new URL(formattedUrl).hostname],
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (researchResp.ok) {
          const researchData = await researchResp.json();
          scrapedContent = researchData?.choices?.[0]?.message?.content || "";
          // Try to extract logo from og:image via citations
        }
      } catch (researchErr) {
        console.error("Perplexity research error (non-fatal):", researchErr);
      }
    }

    // If no content scraped, return minimal profile
    if (!scrapedContent || scrapedContent.length < 50) {
      const minimalProfile = {
        display_name: null,
        tagline: null,
        mission_summary: null,
        logo_url: logoUrl,
        city: null,
        state: null,
        metro_hint: null,
        programs: [],
        populations_served: [],
        keywords: [],
        archetype_suggested: null,
      };

      await upsertProfile(svc, tenant_id, {
        ...minimalProfile,
        website_url: url,
        source_url: url,
        enrichment_source: sourceType,
        enrichment_coverage: "partial",
      });

      return jsonOk({
        ok: true,
        profile: minimalProfile,
        coverage: "partial",
        source_type: sourceType,
      });
    }

    // Extract structured data using AI
    const truncated = scrapedContent.slice(0, 8000);

    const aiResp = await fetch(
      `${supabaseUrl}/functions/v1/ai-proxy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: AI_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `Extract organization identity from this ${sourceType} content:\n\n${truncated}`,
            },
          ],
        }),
      }
    );

    let enrichedProfile: Record<string, unknown> = {};

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const content =
        aiData.choices?.[0]?.message?.content || aiData.content || "";
      enrichedProfile = parseAiJson(content) || {};
    } else {
      const errText = await aiResp.text();
      console.error("AI proxy error:", errText);
    }

    const profile = buildProfile(enrichedProfile, logoUrl);

    await upsertProfile(svc, tenant_id, {
      ...profile,
      website_url: url,
      source_url: url,
      enrichment_source: sourceType,
      enrichment_coverage: coverage,
    });

    return jsonOk({
      ok: true,
      profile,
      coverage,
      source_type: sourceType,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("tenant-enrich-org error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});

// ── Shared constants & helpers ──

const AI_SYSTEM_PROMPT = `You extract organization identity from web content or documents. Return ONLY valid JSON with these fields:
{
  "display_name": "Organization name",
  "tagline": "Short tagline or motto (1 sentence max)",
  "mission_summary": "2-3 sentence mission description",
  "city": "City name or null",
  "state": "State/province or null",
  "metro_hint": "Metro area hint or null",
  "programs": ["program1", "program2"],
  "populations_served": ["population1", "population2"],
  "keywords": ["keyword1", "keyword2"],
  "search_keywords": ["10-15 terms that describe what this organization does, the communities it serves, and the types of partners/events/grants it would seek — e.g. refugee resettlement, ESL programs, digital literacy, food pantry, after-school tutoring"],
  "archetype_suggested": "one of: church, workforce_development, social_enterprise, community_foundation, public_library_or_city_program, nonprofit_program, housing, education, government, or null if unclear"
}
Do NOT include any markdown formatting. Return raw JSON only.`;

function parseAiJson(content: string): Record<string, unknown> | null {
  try {
    const cleaned = content
      .replace(/^```json?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse AI response:", content);
    return null;
  }
}

function buildProfile(
  data: Record<string, unknown>,
  logoUrl: string | null
): Record<string, unknown> {
  return {
    display_name: (data.display_name as string) || null,
    tagline: (data.tagline as string) || null,
    mission_summary: (data.mission_summary as string) || null,
    logo_url: logoUrl || (data.logo_url as string) || null,
    city: (data.city as string) || null,
    state: (data.state as string) || null,
    metro_hint: (data.metro_hint as string) || null,
    programs: (data.programs as string[]) || [],
    populations_served: (data.populations_served as string[]) || [],
    keywords: (data.keywords as string[]) || [],
    search_keywords: (data.search_keywords as string[]) || [],
    archetype_suggested: (data.archetype_suggested as string) || null,
  };
}

function detectSourceType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("facebook.com") || lower.includes("fb.com"))
    return "facebook";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("twitter.com") || lower.includes("x.com"))
    return "twitter";
  return "website";
}

async function upsertProfile(
  svc: ReturnType<typeof createClient>,
  tenantId: string,
  data: Record<string, unknown>
) {
  // Extract search_keywords before passing to profile upsert
  const searchKeywords = Array.isArray(data.search_keywords) ? data.search_keywords as string[] : [];
  const profileData = { ...data };
  delete profileData.search_keywords; // not a column on tenant_public_profiles

  const { error } = await svc.from("tenant_public_profiles").upsert(
    {
      tenant_id: tenantId,
      ...profileData,
      enriched_at: new Date().toISOString(),
      status: "draft",
      visibility_level: "private",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
  if (error) {
    console.error("Profile upsert error:", error.message);
    throw new Error(`Profile upsert failed: ${error.message}`);
  }

  // Save search keywords to tenants table for Perplexity prompt augmentation
  if (searchKeywords.length > 0) {
    const { error: kwErr } = await svc
      .from("tenants")
      .update({
        search_keywords: searchKeywords.slice(0, 20), // cap at 20
        search_keywords_source: "enrichment",
      })
      .eq("id", tenantId);
    if (kwErr) {
      console.error("Search keywords update error (non-fatal):", kwErr.message);
    }
  }
}

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
