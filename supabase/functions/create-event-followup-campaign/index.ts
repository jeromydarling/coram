import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCompanyKbContext } from "../_shared/companyKbContext.ts";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildFallbackTemplate(eventName: string, eventDate: string | null, city: string | null): { subject: string; html_body: string; subject_variants: string[] } {
  const dateStr = eventDate
    ? new Date(eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const locationStr = city ? ` in ${city}` : "";

  const subject = `Great meeting you at ${eventName}`;
  const html_body = `<p>Hi {{ contact.FIRSTNAME }},</p>
<p>It was great meeting you at <strong>${eventName}</strong>${dateStr ? ` on ${dateStr}` : ""}${locationStr}.</p>
<p>I'd love to continue our conversation and explore how we might work together. Would you have time for a brief 15–20 minute intro call this week?</p>
<p>Looking forward to hearing from you.</p>
<p>Best regards</p>`;

  const subject_variants = [
    `Great meeting you at ${eventName}`,
    `Following up from ${eventName}`,
    `Quick follow-up from ${eventName}`,
  ];

  return { subject, html_body, subject_variants };
}

// deno-lint-ignore no-explicit-any
async function generateTemplateViaAI(supabaseUrl: string, authHeader: string, context: any): Promise<{ subject: string; html_body: string; subject_variants: string[]; citations: any } | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/email-template-generate`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_type: "conference_followup",
        context,
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
      subject: data.subject || "",
      html_body: data.body_html || "",
      subject_variants: data.subject_variants || [],
      citations: data.citations || {},
    };
  } catch (err) {
    console.error("Template generation exception:", err);
    return null;
  }
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
    const { event_id, import_batch_id, template_mode, org_knowledge_org_id, selected_subject_index } = body;

    if (!event_id) {
      return jsonError("event_id required");
    }

    // Load event
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, event_name, event_date, city")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      return jsonError("Event not found", 404);
    }

    // Resolve attendees with matched contacts that have emails
    let attendeeQuery = supabase
      .from("event_attendees")
      .select("id, matched_contact_id, raw_email, raw_full_name")
      .eq("event_id", event_id);

    if (import_batch_id) {
      attendeeQuery = attendeeQuery.eq("import_batch_id", import_batch_id);
    }

    const { data: attendees } = await attendeeQuery;

    if (!attendees || attendees.length === 0) {
      return jsonError("No attendees found for this event");
    }

    // Collect contact IDs from matched attendees
    const contactIds = attendees
      .map((a) => a.matched_contact_id)
      .filter(Boolean) as string[];

    // Also collect raw emails from unmatched attendees
    const rawEmails = attendees
      .filter((a) => !a.matched_contact_id && a.raw_email)
      .map((a) => ({ email: a.raw_email!.toLowerCase().trim(), name: a.raw_full_name }));

    // Fetch contacts with emails
    const recipients = new Map<string, { email: string; name: string | null; contact_id: string | null }>();

    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, email, name")
        .in("id", contactIds);

      for (const c of contacts || []) {
        const email = c.email?.toLowerCase().trim();
        if (email && isValidEmail(email) && !recipients.has(email)) {
          recipients.set(email, { email, name: c.name, contact_id: c.id });
        }
      }
    }

    // Add raw emails from unmatched attendees
    for (const r of rawEmails) {
      const email = r.email;
      if (email && isValidEmail(email) && !recipients.has(email)) {
        recipients.set(email, { email, name: r.name, contact_id: null });
      }
    }

    if (recipients.size === 0) {
      return jsonError("No attendees with valid email addresses found");
    }

    // Generate template — try AI first (default), fall back to static
    let subject: string;
    let html_body: string;
    let subject_variants: string[] = [];
    // deno-lint-ignore no-explicit-any
    let citations: any = {};

    const useAI = template_mode !== "generic"; // Default to AI unless explicitly generic

    if (useAI) {
      const templateContext = {
        event_name: event.event_name,
        event_city: event.city,
        event_date: event.event_date,
      };

      const aiResult = await generateTemplateViaAI(SUPABASE_URL, authHeader, templateContext);

      if (aiResult) {
        subject_variants = aiResult.subject_variants;
        // Use selected variant or first one
        const idx = typeof selected_subject_index === "number" && selected_subject_index >= 0 && selected_subject_index < subject_variants.length
          ? selected_subject_index
          : 0;
        subject = subject_variants[idx] || aiResult.subject;
        html_body = aiResult.html_body;
        citations = aiResult.citations;
      } else {
        // Fallback to static template
        const tmpl = buildFallbackTemplate(event.event_name, event.event_date, event.city);
        subject = tmpl.subject;
        html_body = tmpl.html_body;
        subject_variants = tmpl.subject_variants;
      }
    } else {
      const tmpl = buildFallbackTemplate(event.event_name, event.event_date, event.city);
      subject = tmpl.subject;
      html_body = tmpl.html_body;
      subject_variants = tmpl.subject_variants;
    }

    // Load company KB context for provenance
    const companyKb = await getCompanyKbContext(supabase);
    const companyKbVersions = companyKb?.versions || {};

    // Create draft campaign
    const campaignName = `${event.event_name} — Follow up`;
    const { data: campaign, error: campaignErr } = await supabase
      .from("email_campaigns")
      .insert({
        name: campaignName,
        subject,
        html_body,
        created_by: userId,
        status: "draft",
        audience_count: recipients.size,
        metadata: {
          source: "event_followup",
          event_id,
          import_batch_id: import_batch_id || null,
          template_mode: template_mode || "company_kb",
          org_knowledge_org_id: org_knowledge_org_id || null,
          company_kb_versions: { ...companyKbVersions, ...citations?.company_kb_versions },
          subject_variants,
          citations,
        },
      })
      .select("id")
      .single();

    if (campaignErr || !campaign) {
      console.error("Campaign creation failed:", campaignErr);
      return jsonError("Failed to create campaign", 500);
    }

    // Insert audience snapshot
    const audienceRows = Array.from(recipients.values()).map((r) => ({
      campaign_id: campaign.id,
      email: r.email,
      name: r.name,
      contact_id: r.contact_id,
      source: "event_followup",
      status: "queued",
      fingerprint: `${campaign.id}:${r.email}`,
    }));

    const { error: audErr } = await supabase
      .from("email_campaign_audience")
      .upsert(audienceRows, { onConflict: "campaign_id,email" });

    if (audErr) {
      console.error("Audience insert failed:", audErr);
    }

    // Update campaign audience count
    await supabase
      .from("email_campaigns")
      .update({ audience_count: audienceRows.length, status: "audience_ready" })
      .eq("id", campaign.id);

    return jsonResponse({
      ok: true,
      campaign_id: campaign.id,
      audience_count: audienceRows.length,
      subject_variants,
    });
  } catch (error) {
    console.error("create-event-followup-campaign error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
