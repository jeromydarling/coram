import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCompanyKbContext } from "../_shared/companyKbContext.ts";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface OrgContext {
  org_name: string;
  mission?: string;
  partnership_angles?: string[];
  approved_claims?: string[];
}

/**
 * Resolve org enrichment from org_knowledge_snapshots for a given opportunity ID.
 * Returns null if no active authoritative snapshot exists.
 */
async function loadOrgEnrichment(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ snapshot_id: string; context: OrgContext } | null> {
  const { data: snapshot } = await supabase
    .from("org_knowledge_snapshots")
    .select("id, structured_json")
    .eq("org_id", orgId)
    .eq("active", true)
    .eq("is_authoritative", true)
    .maybeSingle();

  if (!snapshot?.structured_json) return null;

  const sj = snapshot.structured_json;
  const ctx: OrgContext = {
    org_name: sj.org_name || "",
  };
  if (sj.mission) ctx.mission = sj.mission;
  if (Array.isArray(sj.partnership_angles) && sj.partnership_angles.length > 0) {
    ctx.partnership_angles = sj.partnership_angles;
  }
  if (Array.isArray(sj.approved_claims) && sj.approved_claims.length > 0) {
    ctx.approved_claims = sj.approved_claims;
  }

  return { snapshot_id: snapshot.id, context: ctx };
}

/**
 * Call email-template-generate with intro_from_search template type.
 */
async function generateIntroDraft(
  supabaseUrl: string,
  authHeader: string,
  orgContext: OrgContext | null,
  orgId: string | null,
): Promise<{ subject: string; html_body: string; subject_variants: string[]; citations: Record<string, unknown> } | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/email-template-generate`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_type: "intro_from_search",
        org_id: orgId,
        context: {
          organization_context: orgContext,
        },
      }),
    });

    if (!response.ok) {
      console.error("Template generation failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.error("Template generation error:", data.error);
      return null;
    }

    return {
      subject: data.subject || "Introduction from PCs for People",
      html_body: data.body_html || "",
      subject_variants: data.subject_variants || [],
      citations: data.citations || {},
    };
  } catch (err) {
    console.error("Template generation exception:", err);
    return null;
  }
}

function buildFallbackTemplate(): { subject: string; html_body: string; subject_variants: string[] } {
  return {
    subject: "Introduction from PCs for People",
    html_body: `<p>Hi {{ contact.FIRSTNAME }},</p>
<p>I'm reaching out from PCs for People. We work to bridge the digital divide by providing affordable technology and internet access to underserved communities.</p>
<p>I'd love to explore how we might collaborate. Would you have time for a brief 15–20 minute introductory call?</p>
<p>Looking forward to connecting.</p>
<p>Best regards</p>`,
    subject_variants: [
      "Introduction from PCs for People",
      "Exploring partnership opportunities",
      "Bridging the digital divide together",
    ],
  };
}

export interface CreateFromSearchBody {
  run_id: string;
  campaign_name?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBody(body: unknown): { valid: true; data: CreateFromSearchBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;
  if (typeof b.run_id !== "string" || !UUID_RE.test(b.run_id)) {
    return { valid: false, error: "run_id: required valid UUID" };
  }
  return {
    valid: true,
    data: {
      run_id: b.run_id,
      campaign_name: typeof b.campaign_name === "string" ? b.campaign_name.trim().slice(0, 200) : undefined,
    },
  };
}

const isTest = Deno.env.get("DENO_TEST") === "1" || (globalThis as Record<string, unknown>).__test_mode === true;
if (!isTest) Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth via getClaims
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Missing Authorization header");
  }

  const token = authHeader.slice(7);
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or expired token");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Block warehouse managers
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  // deno-lint-ignore no-explicit-any
  if ((roles || []).some((r: any) => r.role === "warehouse_manager")) {
    return jsonError(403, "FORBIDDEN", "Access denied");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return jsonError(400, "VALIDATION_ERROR", validation.error);
  }

  const { run_id, campaign_name } = validation.data;

  // 1) Look up the search run — must belong to user
  const { data: searchRun, error: runErr } = await supabaseAdmin
    .from("search_runs")
    .select("id, run_id, search_type, status, raw_query, requested_by")
    .eq("run_id", run_id)
    .maybeSingle();

  if (runErr) {
    return jsonError(500, "DB_ERROR", `Failed to look up search run: ${runErr.message}`);
  }
  if (!searchRun) {
    return jsonError(404, "NOT_FOUND", `No search run found for run_id ${run_id}`);
  }
  if (searchRun.requested_by !== userId) {
    return jsonError(403, "FORBIDDEN", "Cannot create campaign from another user's search");
  }
  if (searchRun.status !== "completed") {
    return jsonError(400, "NOT_COMPLETED", "Search run has not completed yet");
  }

  // 2) Load search results that have contacts
  const { data: results, error: resErr } = await supabaseAdmin
    .from("search_results")
    .select("id, title, organization, contact_name, contact_email, contact_phone, url")
    .eq("search_run_id", searchRun.id)
    .order("result_index", { ascending: true });

  if (resErr) {
    return jsonError(500, "DB_ERROR", `Failed to load results: ${resErr.message}`);
  }

  // Filter to results with valid emails
  const emailResults = (results || []).filter(
    // deno-lint-ignore no-explicit-any
    (r: any) => r.contact_email && isValidEmail(r.contact_email),
  );

  if (emailResults.length === 0) {
    return jsonError(400, "NO_CONTACTS", "No search results with valid email addresses found");
  }

  // 3) Resolve organizations → enrichment
  // Try to match org names to opportunities table for enrichment lookup
  // deno-lint-ignore no-explicit-any
  const orgNames = [...new Set(emailResults.map((r: any) => r.organization).filter(Boolean))] as string[];
  let primaryOrgId: string | null = null;
  let primaryOrgContext: OrgContext | null = null;
  let snapshotId: string | null = null;

  if (orgNames.length > 0) {
    // Try exact match on organization name (case-insensitive via ilike)
    for (const orgName of orgNames) {
      const { data: opp } = await supabaseAdmin
        .from("opportunities")
        .select("id, organization")
        .ilike("organization", orgName)
        .limit(1)
        .maybeSingle();

      if (opp) {
        const enrichment = await loadOrgEnrichment(supabaseAdmin, opp.id);
        if (enrichment) {
          primaryOrgId = opp.id;
          primaryOrgContext = enrichment.context;
          snapshotId = enrichment.snapshot_id;
          break; // Use first match with enrichment
        }
        if (!primaryOrgId) primaryOrgId = opp.id;
      }
    }
  }

  // 4) Generate intro email draft
  let subject: string;
  let htmlBody: string;
  let subjectVariants: string[] = [];
  let citations: Record<string, unknown> = {};

  const aiResult = await generateIntroDraft(
    supabaseUrl,
    authHeader,
    primaryOrgContext,
    primaryOrgId,
  );

  if (aiResult) {
    subject = aiResult.subject;
    htmlBody = aiResult.html_body;
    subjectVariants = aiResult.subject_variants;
    citations = aiResult.citations;
  } else {
    const fallback = buildFallbackTemplate();
    subject = fallback.subject;
    htmlBody = fallback.html_body;
    subjectVariants = fallback.subject_variants;
  }

  // 5) Load company KB for provenance
  const companyKb = await getCompanyKbContext(supabaseAdmin);
  const companyKbVersions = companyKb?.versions || {};

  // 6) Create draft campaign
  const name = campaign_name || `Search follow-up — ${searchRun.raw_query?.slice(0, 50) || "People search"}`;
  const { data: campaign, error: campaignErr } = await supabaseAdmin
    .from("email_campaigns")
    .insert({
      name,
      subject,
      html_body: htmlBody,
      created_by: userId,
      status: "draft",
      audience_count: emailResults.length,
      metadata: {
        source: "search_followup",
        search_run_id: run_id,
        search_type: searchRun.search_type,
        template_mode: aiResult ? "enriched_intro" : "fallback",
        org_knowledge_org_id: primaryOrgId,
        org_knowledge_snapshot_id: snapshotId,
        organization_context: primaryOrgContext ? {
          mission_snapshot: primaryOrgContext.mission || null,
          partnership_angles: primaryOrgContext.partnership_angles || null,
        } : null,
        company_kb_versions: { ...companyKbVersions, ...(citations?.company_kb_versions as Record<string, unknown> || {}) },
        subject_variants: subjectVariants,
        citations,
      },
    })
    .select("id")
    .single();

  if (campaignErr || !campaign) {
    console.error("Campaign creation failed:", campaignErr);
    return jsonError(500, "DB_ERROR", "Failed to create campaign");
  }

  // 7) Insert audience from search results
  // deno-lint-ignore no-explicit-any
  const audienceRows = emailResults.map((r: any) => ({
    campaign_id: campaign.id,
    email: r.contact_email.toLowerCase().trim(),
    name: r.contact_name || r.title || null,
    contact_id: null, // Not linked to CRM contacts yet
    source: "search_followup",
    status: "queued",
    fingerprint: `${campaign.id}:${r.contact_email.toLowerCase().trim()}`,
  }));

  // Dedupe by email
  const seen = new Set<string>();
  const dedupedRows = audienceRows.filter((r: { email: string }) => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });

  const { error: audErr } = await supabaseAdmin
    .from("email_campaign_audience")
    .insert(dedupedRows);

  if (audErr) {
    console.error("Audience insert failed:", audErr);
  }

  // Update audience count
  await supabaseAdmin
    .from("email_campaigns")
    .update({ audience_count: dedupedRows.length, status: "audience_ready" })
    .eq("id", campaign.id);

  return jsonOk({
    ok: true,
    campaign_id: campaign.id,
    audience_count: dedupedRows.length,
    enrichment_used: !!primaryOrgContext,
    subject_variants: subjectVariants,
  });
});
