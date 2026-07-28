import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCompanyKbContext, buildCompanyKbSystemBlock } from "../_shared/companyKbContext.ts";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_MODES = ["partnership_intro", "grant_collaboration", "event_networking", "leadership_intro", "follow_up"] as const;

export interface GenerateBody {
  opportunity_id: string;
  outreach_mode: string;
  campaign_id?: string;
  contact_names?: string[];
}

export function validateBody(body: unknown): { valid: true; data: GenerateBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.opportunity_id !== "string" || !UUID_RE.test(b.opportunity_id)) {
    return { valid: false, error: "opportunity_id: required valid UUID" };
  }
  if (typeof b.outreach_mode !== "string" || !VALID_MODES.includes(b.outreach_mode as typeof VALID_MODES[number])) {
    return { valid: false, error: `outreach_mode: must be one of ${VALID_MODES.join(", ")}` };
  }
  if (b.campaign_id !== undefined && b.campaign_id !== null) {
    if (typeof b.campaign_id !== "string" || !UUID_RE.test(b.campaign_id)) {
      return { valid: false, error: "campaign_id: must be a valid UUID if provided" };
    }
  }

  return {
    valid: true,
    data: {
      opportunity_id: b.opportunity_id,
      outreach_mode: b.outreach_mode as string,
      campaign_id: typeof b.campaign_id === "string" ? b.campaign_id : undefined,
      contact_names: Array.isArray(b.contact_names) ? b.contact_names.filter((n: unknown) => typeof n === "string") : undefined,
    },
  };
}

const MODE_PROMPTS: Record<string, { label: string; instruction: string }> = {
  partnership_intro: {
    label: "Partnership Introduction",
    instruction: "Write a warm, professional introductory email exploring partnership potential. Focus on shared mission alignment around digital equity and community impact. Keep it ≤7 sentences. Goal: request a brief intro call.",
  },
  grant_collaboration: {
    label: "Grant Collaboration",
    instruction: "Write an email proposing grant collaboration. Reference specific grant or funding alignment areas. Focus on complementary strengths and how joint applications would be stronger. Keep it ≤7 sentences. Goal: explore co-application potential.",
  },
  event_networking: {
    label: "Event Networking",
    instruction: "Write a networking follow-up email referencing a shared event or conference context. Keep it ≤5 sentences. Tone: casual-professional. Goal: continue the conversation started at the event.",
  },
  leadership_intro: {
    label: "Leadership Introduction",
    instruction: "Write a high-level leadership introduction email. Tone: executive, strategic. Reference organizational mission alignment and potential for strategic partnership. Keep it ≤6 sentences. Goal: request a leadership-level conversation.",
  },
  follow_up: {
    label: "Follow-up",
    instruction: "Write a follow-up email to a previous outreach or meeting. Tone: warm, concise. Reference prior interaction and suggest next steps. Keep it ≤5 sentences. Goal: move the relationship forward.",
  },
};

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableApiKey) {
    return jsonError(503, "CONFIG_ERROR", "AI not configured");
  }

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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Block warehouse managers
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if ((roles || []).some((r: { role: string }) => r.role === "warehouse_manager")) {
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

  const { opportunity_id, outreach_mode, campaign_id, contact_names } = validation.data;

  // Load opportunity
  const { data: opp, error: oppErr } = await supabaseAdmin
    .from("opportunities")
    .select("id, organization, website_url, mission_snapshot, best_partnership_angle, grant_alignment")
    .eq("id", opportunity_id)
    .maybeSingle();

  if (oppErr || !opp) {
    return jsonError(404, "NOT_FOUND", "Opportunity not found");
  }

  // Load org knowledge
  const { data: orgSnapshot } = await supabaseAdmin
    .from("org_knowledge_snapshots")
    .select("id, structured_json")
    .eq("org_id", opportunity_id)
    .eq("active", true)
    .eq("is_authoritative", true)
    .maybeSingle();

  // Load prospect pack
  const { data: prospectPack } = await supabaseAdmin
    .from("prospect_packs")
    .select("pack_json")
    .eq("entity_id", opportunity_id)
    .eq("entity_type", "opportunity")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Load company KB
  const companyKb = await getCompanyKbContext(supabaseAdmin);
  const companyKbBlock = companyKb ? buildCompanyKbSystemBlock(companyKb) : "";

  const modeConfig = MODE_PROMPTS[outreach_mode];
  const runId = crypto.randomUUID();

  // Create draft record as "generating"
  await supabaseAdmin.from("outreach_drafts").insert({
    campaign_id: campaign_id || null,
    opportunity_id,
    outreach_mode,
    run_id: runId,
    subject: "Generating...",
    body_html: "",
    alternates: [],
    context_json: { org_name: opp.organization, mode: outreach_mode },
    created_by: userId,
    status: "generating",
  });

  try {
    // Build context
    let orgContext = `Organization: ${opp.organization}`;
    if (opp.website_url) orgContext += `\nWebsite: ${opp.website_url}`;
    if (opp.mission_snapshot?.length) orgContext += `\nMission: ${opp.mission_snapshot.join(", ")}`;
    if (opp.best_partnership_angle?.length) orgContext += `\nPartnership Angles: ${opp.best_partnership_angle.join(", ")}`;
    if (opp.grant_alignment?.length) orgContext += `\nGrant Alignment: ${opp.grant_alignment.join(", ")}`;

    if (orgSnapshot?.structured_json) {
      const sj = orgSnapshot.structured_json as Record<string, unknown>;
      if (sj.mission) orgContext += `\nDetailed Mission: ${sj.mission}`;
      if (Array.isArray(sj.approved_claims) && sj.approved_claims.length) {
        orgContext += `\nApproved Claims: ${(sj.approved_claims as string[]).slice(0, 3).join("; ")}`;
      }
    }

    if (prospectPack?.pack_json) {
      const pack = prospectPack.pack_json as Record<string, unknown>;
      if (pack.suggested_outreach_angle) orgContext += `\nSuggested Angle: ${pack.suggested_outreach_angle}`;
    }

    if (contact_names?.length) {
      orgContext += `\nContact(s): ${contact_names.join(", ")}`;
    }

    const systemPrompt = `You are an email template generator for PCs for People.
${companyKbBlock}

OUTREACH MODE: ${modeConfig.label}
${modeConfig.instruction}

RULES:
- Never invent facts about the target organization
- Never claim a prior relationship unless stated
- Never promise funding or contracts
- Use {{ contact.FIRSTNAME }} for personalization

OUTPUT: Return ONLY valid JSON:
{
  "subject": "primary subject line",
  "body_html": "HTML email body using <p> tags",
  "alternates": [
    { "subject": "alternate subject 1", "body_html": "alternate body 1" },
    { "subject": "alternate subject 2", "body_html": "alternate body 2" }
  ]
}

Return raw JSON only. No markdown fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a ${modeConfig.label} outreach email for:\n\n${orgContext}` },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      await supabaseAdmin.from("outreach_drafts").update({ status: "failed" }).eq("run_id", runId);

      if (response.status === 429) {
        return jsonError(429, "RATE_LIMITED", "AI rate limit exceeded, try again later");
      }
      if (response.status === 402) {
        return jsonError(402, "PAYMENT_REQUIRED", "AI credits exhausted");
      }
      return jsonError(500, "AI_ERROR", "Draft generation failed");
    }

    const aiData = await response.json();
    const rawText = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawText);
      await supabaseAdmin.from("outreach_drafts").update({ status: "failed" }).eq("run_id", runId);
      return jsonError(500, "PARSE_ERROR", "AI returned invalid JSON");
    }

    // Sanitize HTML
    if (parsed.body_html) {
      parsed.body_html = parsed.body_html.replace(/<script[\s\S]*?<\/script>/gi, "");
    }
    if (Array.isArray(parsed.alternates)) {
      parsed.alternates = parsed.alternates.map((a: { subject?: string; body_html?: string }) => ({
        subject: a.subject || parsed.subject,
        body_html: (a.body_html || "").replace(/<script[\s\S]*?<\/script>/gi, ""),
      }));
    }

    // Update draft record
    await supabaseAdmin
      .from("outreach_drafts")
      .update({
        subject: parsed.subject || "Draft outreach",
        body_html: parsed.body_html || "",
        alternates: parsed.alternates || [],
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("run_id", runId);

    return jsonOk({
      ok: true,
      draft_id: runId,
      subject: parsed.subject,
      body_html: parsed.body_html,
      alternates: parsed.alternates || [],
      mode: outreach_mode,
    });
  } catch (err) {
    console.error("Draft generation error:", err);
    await supabaseAdmin.from("outreach_drafts").update({ status: "failed" }).eq("run_id", runId);
    return jsonError(500, "INTERNAL_ERROR", "Draft generation failed");
  }
}

Deno.serve(handleRequest);
