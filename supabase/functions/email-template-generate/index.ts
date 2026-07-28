import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCompanyKbContext, buildCompanyKbSystemBlock } from "../_shared/companyKbContext.ts";

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
async function callLovableAI(messages: any[], maxTokens = 2000): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// deno-lint-ignore no-explicit-any
function buildIntroFromSearchPrompt(companyKb: any, orgSnapshot: any, context: any): any[] {
  const companyKbBlock = companyKb ? buildCompanyKbSystemBlock(companyKb) : "";

  // Extract organization_context passed from campaign-create-from-search
  const orgCtx = context?.organization_context;

  const systemPrompt = `You are an email template generator for PCs for People.
${companyKbBlock}

INTRO EMAIL RULES (STRICT):
- Never invent facts about the target organization
- Never claim a prior relationship unless explicitly stated
- Never promise funding, contracts, or commitments
- If organization context is provided, use it to frame relevance naturally
- If a field is missing, ignore it entirely — do not guess
- Keep body length ≤ 7 sentences
- Tone: warm, professional, concise
- Goal: request a brief introductory conversation

PERSONALIZATION TOKENS (use exactly these):
- {{ contact.FIRSTNAME }}

OUTPUT FORMAT — Return ONLY valid JSON with this structure:
{
  "subject": "string — primary subject line",
  "subject_variants": ["string", "string", "string"] — exactly 3 subject variants,
  "body_html": "string — HTML email body using <p> tags",
  "plain_text": "string — plain text version",
  "allowed_tokens_used": ["{{ contact.FIRSTNAME }}"],
  "citations": {
    "company_kb_versions": {},
    "org_snapshot_id": null,
    "source_urls": []
  }
}

Do not wrap in markdown code blocks. Return raw JSON only.`;

  let userPrompt = `Generate an introductory outreach email for PCs for People to send to a prospective partner.`;

  if (orgCtx) {
    userPrompt += `\n\n--- TARGET ORGANIZATION PROFILE (use as context, do NOT invent beyond this) ---`;
    if (orgCtx.org_name) userPrompt += `\nOrganization: ${orgCtx.org_name}`;
    if (orgCtx.mission) userPrompt += `\nMission (1 sentence max in email): ${orgCtx.mission}`;
    if (orgCtx.partnership_angles?.length > 0) {
      userPrompt += `\nPartnership angles (frame as "areas where collaboration may make sense"): ${orgCtx.partnership_angles.join(", ")}`;
    }
    if (orgCtx.approved_claims?.length > 0) {
      userPrompt += `\nApproved claims about this org (may reference): ${orgCtx.approved_claims.slice(0, 3).join("; ")}`;
    }
    userPrompt += `\n--- END TARGET ORGANIZATION ---`;
  } else {
    userPrompt += `\n\nNo specific organization context is available. Write a general introduction.`;
  }

  // Also use org_knowledge_snapshots loaded by email-template-generate if org_id was passed
  if (orgSnapshot?.structured_json && !orgCtx) {
    const sj = orgSnapshot.structured_json;
    userPrompt += `\n\n--- TARGET ORGANIZATION PROFILE (secondary context) ---`;
    if (sj.org_name) userPrompt += `\nOrganization: ${sj.org_name}`;
    if (sj.mission) userPrompt += `\nMission: ${sj.mission}`;
    if (sj.partnership_angles?.length > 0) {
      userPrompt += `\nPartnership angles: ${sj.partnership_angles.join(", ")}`;
    }
    userPrompt += `\n--- END TARGET ORGANIZATION ---`;
  }

  // Provenance
  const kbVersions = companyKb?.versions || {};
  userPrompt += `\n\nFor the citations field, use company_kb_versions: ${JSON.stringify(kbVersions)}`;
  if (orgSnapshot?.id) {
    userPrompt += `, org_snapshot_id: "${orgSnapshot.id}"`;
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

// deno-lint-ignore no-explicit-any
function buildPrompt(preset: any, companyKb: any, orgSnapshot: any, context: any): any[] {
  const defaults = preset.defaults || {};
  const constraints = (defaults.constraints || []).map((c: string) => `- ${c}`).join("\n");

  // System prompt with company KB
  const companyKbBlock = companyKb ? buildCompanyKbSystemBlock(companyKb) : "";

  const systemPrompt = `You are an email template generator for PCs for People.
${companyKbBlock}

TEMPLATE CONSTRAINTS:
${constraints}

PERSONALIZATION TOKENS (use exactly these):
- {{ contact.FIRSTNAME }}

OUTPUT FORMAT — Return ONLY valid JSON with this structure:
{
  "subject": "string — primary subject line",
  "subject_variants": ["string", "string", "string"] — exactly 3 subject variants that include the event name,
  "body_html": "string — HTML email body using <p> tags",
  "plain_text": "string — plain text version",
  "allowed_tokens_used": ["{{ contact.FIRSTNAME }}"],
  "citations": {
    "company_kb_versions": {},
    "org_snapshot_id": null,
    "source_urls": []
  }
}

Do not wrap in markdown code blocks. Return raw JSON only.`;

  // Build user prompt
  let userPrompt = `Generate a conference follow-up email template.

Event: ${context.event_name || "the event"}`;

  if (context.event_city) {
    userPrompt += `\nLocation: ${context.event_city}`;
  }
  if (context.event_date) {
    userPrompt += `\nDate: ${context.event_date}`;
  }

  userPrompt += `\n\nAsk type: ${defaults.ask_type || "intro_call"}
Tone: ${defaults.tone || "warm"}
Length: ${defaults.length || "short"}`;

  // Subject variant hints
  const subjectVariants = defaults.subject_variants || [];
  if (subjectVariants.length > 0) {
    const resolved = subjectVariants.map((s: string) =>
      s.replace("{{ context.event_name }}", context.event_name || "the event")
    );
    userPrompt += `\n\nSuggested subject line templates (adapt these):\n${resolved.map((s: string) => `- ${s}`).join("\n")}`;
  }

  // Optional org snapshot
  if (orgSnapshot?.structured_json) {
    const sj = orgSnapshot.structured_json;
    userPrompt += `\n\n--- TARGET ORGANIZATION PROFILE (secondary context) ---`;
    if (sj.org_name) userPrompt += `\nOrganization: ${sj.org_name}`;
    if (sj.mission) userPrompt += `\nMission: ${sj.mission}`;
    if (sj.partnership_angles?.length > 0) {
      userPrompt += `\nPartnership angles: ${sj.partnership_angles.join(", ")}`;
    }
    userPrompt += `\n--- END TARGET ORGANIZATION ---`;
  }

  // Add provenance info for citations
  const kbVersions = companyKb?.versions || {};
  userPrompt += `\n\nFor the citations field, use company_kb_versions: ${JSON.stringify(kbVersions)}`;
  if (orgSnapshot?.id) {
    userPrompt += `, org_snapshot_id: "${orgSnapshot.id}"`;
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return jsonError("Invalid token", 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Block warehouse managers
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    // deno-lint-ignore no-explicit-any
    if ((roles || []).some((r: any) => r.role === "warehouse_manager")) {
      return jsonError("Access denied", 403);
    }

    const body = await req.json();
    const {
      template_type,
      ask_type,
      tone,
      length: templateLength,
      context: templateContext = {},
      org_id,
    } = body;

    // Load preset defaults if conference_followup and params missing
    // deno-lint-ignore no-explicit-any
    let preset: any = {
      defaults: {
        ask_type: ask_type || "intro_call",
        tone: tone || "warm",
        length: templateLength || "short",
        subject_variants: [],
        constraints: [],
      },
    };

    if (template_type === "conference_followup") {
      const { data: presetRow } = await supabase
        .from("email_template_presets")
        .select("*")
        .eq("template_type", "conference_followup")
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (presetRow) {
        preset = presetRow;
        // Override with explicit params if provided
        if (ask_type) preset.defaults.ask_type = ask_type;
        if (tone) preset.defaults.tone = tone;
        if (templateLength) preset.defaults.length = templateLength;
      }
    }

    // Always load company KB
    const companyKb = await getCompanyKbContext(supabase);

    // Optionally load org snapshot
    // deno-lint-ignore no-explicit-any
    let orgSnapshot: any = null;
    if (org_id) {
      const { data: snapshot } = await supabase
        .from("org_knowledge_snapshots")
        .select("id, structured_json")
        .eq("org_id", org_id)
        .eq("active", true)
        .eq("is_authoritative", true)
        .maybeSingle();
      orgSnapshot = snapshot;
    }

    // Build prompt and call AI — use different prompt builder for intro_from_search
    const messages = template_type === "intro_from_search"
      ? buildIntroFromSearchPrompt(companyKb, orgSnapshot, templateContext)
      : buildPrompt(preset, companyKb, orgSnapshot, templateContext);
    const aiResponse = await callLovableAI(messages, 2000);

    // Parse AI response
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", aiResponse);
      return jsonError("AI returned invalid JSON", 500);
    }

    // Validate subject_variants
    if (!Array.isArray(parsed.subject_variants) || parsed.subject_variants.length < 3) {
      if (template_type === "intro_from_search") {
        parsed.subject_variants = [
          parsed.subject || "Introduction from PCs for People",
          "Exploring partnership opportunities",
          "Bridging the digital divide together",
        ];
      } else {
        const eventName = templateContext.event_name || "the event";
        parsed.subject_variants = [
          parsed.subject || `Great meeting you at ${eventName}`,
          `Following up from ${eventName}`,
          `Quick follow-up from ${eventName}`,
        ];
      }
    }

    // Sanitize: no scripts in HTML
    if (parsed.body_html) {
      parsed.body_html = parsed.body_html.replace(/<script[\s\S]*?<\/script>/gi, "");
    }

    // Add provenance
    if (!parsed.citations) {
      parsed.citations = {};
    }
    parsed.citations.company_kb_versions = companyKb?.versions || {};
    parsed.citations.org_snapshot_id = orgSnapshot?.id || null;

    return jsonResponse(parsed);
  } catch (error) {
    console.error("email-template-generate error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
