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

interface SegmentDefinition {
  partner_tiers?: string[];
  opportunity_ids?: string[];
  metro_ids?: string[];
  has_email_only?: boolean;
}

interface AudienceRecipient {
  email: string;
  name: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  source: "segment" | "org_people" | "manual";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseManualEmails(input: string): AudienceRecipient[] {
  const results: AudienceRecipient[] = [];
  const lines = input.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      const email = match[2].toLowerCase().trim();
      if (email && isValidEmail(email)) {
        results.push({
          email,
          name: match[1].trim() || null,
          contact_id: null,
          opportunity_id: null,
          source: "manual",
        });
      }
    } else if (line.includes("@")) {
      const email = line.toLowerCase().trim();
      if (isValidEmail(email)) {
        results.push({
          email,
          name: null,
          contact_id: null,
          opportunity_id: null,
          source: "manual",
        });
      }
    }
  }

  return results;
}

// deno-lint-ignore no-explicit-any
async function buildAudience(
  supabaseAdmin: any,
  campaignId: string,
  definition: SegmentDefinition,
  manualEmails?: string
): Promise<{ audience_count: number; invalid_count: number; duplicate_count: number }> {
  // Delete existing audience rows
  await supabaseAdmin
    .from("email_campaign_audience")
    .delete()
    .eq("campaign_id", campaignId);

  const recipients = new Map<string, AudienceRecipient>();
  let invalidCount = 0;

  // Query opportunities based on filters
  let query = supabaseAdmin
    .from("opportunities")
    .select("id, metro_id");

  if (definition.partner_tiers?.length) {
    query = query.overlaps("partner_tiers", definition.partner_tiers);
  }
  if (definition.metro_ids?.length) {
    query = query.in("metro_id", definition.metro_ids);
  }
  if (definition.opportunity_ids?.length) {
    query = query.in("id", definition.opportunity_ids);
  }

  const { data: opportunities } = await query;
  // deno-lint-ignore no-explicit-any
  const opportunityIds = (opportunities || []).map((o: any) => o.id);

  // Fetch contacts for matched opportunities
  if (opportunityIds.length > 0) {
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id, email, name, opportunity_id")
      .in("opportunity_id", opportunityIds);

    // deno-lint-ignore no-explicit-any
    for (const contact of (contacts || []) as any[]) {
      const email = contact.email?.toLowerCase().trim();
      if (!email || !isValidEmail(email)) {
        if (contact.email) invalidCount++;
        continue;
      }

      recipients.set(email, {
        email,
        name: contact.name,
        contact_id: contact.id,
        opportunity_id: contact.opportunity_id,
        source: "segment",
      });
    }
  }

  // Organization People - explicitly selected orgs
  if (definition.opportunity_ids?.length) {
    const { data: orgContacts } = await supabaseAdmin
      .from("contacts")
      .select("id, email, name, opportunity_id")
      .in("opportunity_id", definition.opportunity_ids);

    // deno-lint-ignore no-explicit-any
    for (const contact of (orgContacts || []) as any[]) {
      const email = contact.email?.toLowerCase().trim();
      if (!email || !isValidEmail(email)) {
        if (contact.email) invalidCount++;
        continue;
      }

      if (!recipients.has(email)) {
        recipients.set(email, {
          email,
          name: contact.name,
          contact_id: contact.id,
          opportunity_id: contact.opportunity_id,
          source: "org_people",
        });
      }
    }
  }

  // Manual emails
  if (manualEmails) {
    const allLines = manualEmails.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    const parsed = parseManualEmails(manualEmails);
    invalidCount += allLines.length - parsed.length;
    for (const r of parsed) {
      if (!recipients.has(r.email)) {
        recipients.set(r.email, r);
      }
    }
  }

  // Insert deduped audience rows with status=queued
  const audienceRows = Array.from(recipients.values()).map((r) => ({
    campaign_id: campaignId,
    contact_id: r.contact_id,
    email: r.email,
    name: r.name,
    opportunity_id: r.opportunity_id,
    source: r.source,
    status: "queued",
    fingerprint: `${campaignId}:${r.email}`,
  }));

  if (audienceRows.length > 0) {
    // Use upsert to handle any remaining duplicates gracefully
    await supabaseAdmin
      .from("email_campaign_audience")
      .upsert(audienceRows, { onConflict: "campaign_id,email" });
  }

  // Update campaign status to audience_ready
  await supabaseAdmin
    .from("email_campaigns")
    .update({
      audience_count: audienceRows.length,
      status: "audience_ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  // Log event
  await supabaseAdmin.from("email_campaign_events").insert({
    campaign_id: campaignId,
    event_type: "audience_built",
    meta: {
      audience_count: audienceRows.length,
      invalid_count: invalidCount,
      duplicate_count: 0,
    },
  });

  return {
    audience_count: audienceRows.length,
    invalid_count: invalidCount,
    duplicate_count: 0,
  };
}

// deno-lint-ignore no-explicit-any
async function removeRecipients(
  supabaseAdmin: any,
  campaignId: string,
  recipientIds: string[]
): Promise<{ removed_count: number; new_count: number }> {
  const { error: deleteError } = await supabaseAdmin
    .from("email_campaign_audience")
    .delete()
    .in("id", recipientIds);

  if (deleteError) throw deleteError;

  const { count } = await supabaseAdmin
    .from("email_campaign_audience")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const newCount = count ?? 0;

  await supabaseAdmin
    .from("email_campaigns")
    .update({ audience_count: newCount, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  return { removed_count: recipientIds.length, new_count: newCount };
}

// deno-lint-ignore no-explicit-any
async function previewEmail(
  supabaseAdmin: any,
  campaignId: string,
  audienceId?: string,
  email?: string
): Promise<{ subject: string; body_html: string; rendered_to: Record<string, string> }> {
  const { data: campaign } = await supabaseAdmin
    .from("email_campaigns")
    .select("subject, html_body")
    .eq("id", campaignId)
    .single();

  if (!campaign) throw new Error("Campaign not found");

  // Get a sample recipient
  let recipient = { email: email || "example@example.com", name: "Sample Recipient", opportunity_id: null as string | null };

  if (audienceId) {
    const { data: member } = await supabaseAdmin
      .from("email_campaign_audience")
      .select("email, name, opportunity_id")
      .eq("id", audienceId)
      .single();
    if (member) {
      recipient = { email: member.email, name: member.name || "", opportunity_id: member.opportunity_id };
    }
  } else if (!email) {
    // Get first audience member
    const { data: members } = await supabaseAdmin
      .from("email_campaign_audience")
      .select("email, name, opportunity_id")
      .eq("campaign_id", campaignId)
      .limit(1);
    if (members?.[0]) {
      recipient = { email: members[0].email, name: members[0].name || "", opportunity_id: members[0].opportunity_id };
    }
  }

  // Resolve organization name
  let organization = "your organization";
  if (recipient.opportunity_id) {
    const { data: opp } = await supabaseAdmin
      .from("opportunities")
      .select("name")
      .eq("id", recipient.opportunity_id)
      .maybeSingle();
    if (opp?.name) organization = opp.name;
  }

  const nameParts = (recipient.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const replaceTags = (text: string) => text
    .replace(/\{\{\s*contact\.FIRSTNAME\s*\}\}/gi, firstName)
    .replace(/\{\{\s*contact\.LASTNAME\s*\}\}/gi, lastName)
    .replace(/\{\{\s*contact\.FULLNAME\s*\}\}/gi, recipient.name || "")
    .replace(/\{\{\s*contact\.EMAIL\s*\}\}/gi, recipient.email)
    .replace(/\{\{\s*contact\.ORGANIZATION\s*\}\}/gi, organization)
    .replace(/\{\{\s*unsubscribe\s*\}\}/gi, "");

  return {
    subject: replaceTags(campaign.subject || ""),
    body_html: replaceTags(campaign.html_body || ""),
    rendered_to: {
      email: recipient.email,
      first_name: firstName,
      last_name: lastName,
      full_name: recipient.name || "",
      organization,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT
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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if warehouse_manager (blocked)
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // deno-lint-ignore no-explicit-any
    const isWarehouseManager = (roles || []).some((r: any) => r.role === "warehouse_manager");
    if (isWarehouseManager) {
      return jsonError("Access denied", 403);
    }

    const body = await req.json();
    const { action, campaign_id, definition, manual_emails, recipient_ids, audience_id, email: previewEmail_ } = body;

    if (!campaign_id) {
      return jsonError("campaign_id required");
    }

    // Verify campaign ownership
    const { data: campaign } = await supabaseAdmin
      .from("email_campaigns")
      .select("id, created_by, status")
      .eq("id", campaign_id)
      .single();

    if (!campaign) {
      return jsonError("Campaign not found", 404);
    }

    if (campaign.created_by !== userId) {
      return jsonError("Access denied", 403);
    }

    // Rate limit
    const { data: withinLimit } = await supabaseAdmin.rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_function_name: "campaign-audience",
      p_window_minutes: 1,
      p_max_requests: 30,
    });

    if (!withinLimit) {
      return jsonError("Rate limit exceeded", 429);
    }

    if (action === "build_audience") {
      if (!["draft", "audience_ready"].includes(campaign.status)) {
        return jsonError("Can only build audience for draft/audience_ready campaigns");
      }

      const result = await buildAudience(
        supabaseAdmin,
        campaign_id,
        definition || {},
        manual_emails
      );
      return jsonResponse(result);
    }

    if (action === "remove_recipients") {
      if (!["draft", "audience_ready"].includes(campaign.status)) {
        return jsonError("Can only modify audience for draft/audience_ready campaigns");
      }

      if (!Array.isArray(recipient_ids) || recipient_ids.length === 0) {
        return jsonError("recipient_ids array required");
      }

      const result = await removeRecipients(supabaseAdmin, campaign_id, recipient_ids);
      return jsonResponse(result);
    }

    if (action === "preview") {
      const result = await previewEmail(supabaseAdmin, campaign_id, audience_id, previewEmail_);
      return jsonResponse(result);
    }

    return jsonError("Invalid action. Supported: build_audience, remove_recipients, preview");
  } catch (error) {
    console.error("campaign-audience error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return jsonError(message, 500);
  }
});
