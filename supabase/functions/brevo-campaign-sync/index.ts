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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Name parsing helpers for personalization
function parseFirstName(fullName: string | null): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

function parseLastName(fullName: string | null): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

function buildContactAttributes(name: string | null): Record<string, string> {
  if (!name) return {};
  const firstName = parseFirstName(name);
  const lastName = parseLastName(name);
  const attrs: Record<string, string> = {};
  if (firstName) attrs.FIRSTNAME = firstName;
  if (lastName) attrs.LASTNAME = lastName;
  attrs.FULLNAME = name;
  return attrs;
}

interface SegmentDefinition {
  partner_tiers?: string[];
  mission_snapshots?: string[];
  best_partnership_angles?: string[];
  stages?: string[];
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

function parseManualEmails(input: string): AudienceRecipient[] {
  const results: AudienceRecipient[] = [];
  const lines = input.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      const email = match[2].toLowerCase().trim();
      if (email && email.includes("@")) {
        results.push({
          email,
          name: match[1].trim() || null,
          contact_id: null,
          opportunity_id: null,
          source: "manual",
        });
      }
    } else if (line.includes("@")) {
      results.push({
        email: line.toLowerCase().trim(),
        name: null,
        contact_id: null,
        opportunity_id: null,
        source: "manual",
      });
    }
  }

  return results;
}

// deno-lint-ignore no-explicit-any
async function ensureMetroList(
  supabaseAdmin: any,
  brevoApiKey: string,
  metroId: string
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("brevo_metro_lists")
    .select("brevo_list_id")
    .eq("metro_id", metroId)
    .maybeSingle();

  if (existing?.brevo_list_id) {
    return existing.brevo_list_id;
  }

  const { data: metro } = await supabaseAdmin
    .from("metros")
    .select("metro")
    .eq("id", metroId)
    .single();

  if (!metro?.metro) throw new Error(`Metro not found: ${metroId}`);

  const listName = `Profunda Metro — ${metro.metro}`;

  const createRes = await fetch("https://api.brevo.com/v3/contacts/lists", {
    method: "POST",
    headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ name: listName, folderId: 1 }),
  });

  let brevoListId: number;

  if (createRes.ok) {
    const created = await createRes.json();
    brevoListId = created.id;
  } else {
    const searchRes = await fetch("https://api.brevo.com/v3/contacts/lists?limit=50", {
      headers: { "api-key": brevoApiKey },
    });
    const searchData = await searchRes.json();
    // deno-lint-ignore no-explicit-any
    const found = (searchData.lists || []).find((l: any) => l.name === listName);
    if (!found) throw new Error(`Could not find or create list: ${listName}`);
    brevoListId = found.id;
  }

  await supabaseAdmin.from("brevo_metro_lists").insert({
    metro_id: metroId,
    brevo_list_id: String(brevoListId),
    brevo_list_name: listName,
  });

  return String(brevoListId);
}

// deno-lint-ignore no-explicit-any
async function buildAudience(
  supabaseAdmin: any,
  campaignId: string,
  definition: SegmentDefinition,
  manualEmails?: string
): Promise<{ audience_count: number }> {
  await supabaseAdmin
    .from("email_campaign_audience")
    .delete()
    .eq("campaign_id", campaignId);

  const recipients = new Map<string, AudienceRecipient>();

  let query = supabaseAdmin
    .from("opportunities")
    .select("id, metro_id");

  if (definition.partner_tiers?.length) {
    query = query.overlaps("partner_tiers", definition.partner_tiers);
  }
  if (definition.mission_snapshots?.length) {
    query = query.overlaps("mission_snapshot", definition.mission_snapshots);
  }
  if (definition.best_partnership_angles?.length) {
    query = query.overlaps("best_partnership_angle", definition.best_partnership_angles);
  }
  if (definition.stages?.length) {
    query = query.in("stage", definition.stages);
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

  if (opportunityIds.length > 0) {
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id, email, name, opportunity_id")
      .in("opportunity_id", opportunityIds);

    // deno-lint-ignore no-explicit-any
    for (const contact of (contacts || []) as any[]) {
      const email = contact.email?.toLowerCase().trim();
      if (!email || !email.includes("@")) continue;
      if (definition.has_email_only === false) continue;

      recipients.set(email, {
        email,
        name: contact.name,
        contact_id: contact.id,
        opportunity_id: contact.opportunity_id,
        source: "segment",
      });
    }
  }

  if (definition.opportunity_ids?.length) {
    const { data: orgContacts } = await supabaseAdmin
      .from("contacts")
      .select("id, email, name, opportunity_id")
      .in("opportunity_id", definition.opportunity_ids);

    // deno-lint-ignore no-explicit-any
    for (const contact of (orgContacts || []) as any[]) {
      const email = contact.email?.toLowerCase().trim();
      if (!email || !email.includes("@")) continue;

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

  if (manualEmails) {
    const parsed = parseManualEmails(manualEmails);
    for (const r of parsed) {
      if (!recipients.has(r.email)) {
        recipients.set(r.email, r);
      }
    }
  }

  const audienceRows = Array.from(recipients.values()).map((r) => ({
    campaign_id: campaignId,
    contact_id: r.contact_id,
    email: r.email,
    name: r.name,
    opportunity_id: r.opportunity_id,
    source: r.source,
  }));

  if (audienceRows.length > 0) {
    await supabaseAdmin.from("email_campaign_audience").insert(audienceRows);
  }

  await supabaseAdmin
    .from("email_campaigns")
    .update({ audience_count: audienceRows.length, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  await supabaseAdmin.from("email_campaign_events").insert({
    campaign_id: campaignId,
    event_type: "audience_built",
    meta: { audience_count: audienceRows.length },
  });

  return { audience_count: audienceRows.length };
}

// deno-lint-ignore no-explicit-any
async function syncToBrevo(
  supabaseAdmin: any,
  brevoApiKey: string,
  campaignId: string,
  definition: SegmentDefinition
): Promise<{ synced: number; campaign_list_id: string; metro_list_ids: string[] }> {
  const { data: campaign } = await supabaseAdmin
    .from("email_campaigns")
    .select("brevo_list_id")
    .eq("id", campaignId)
    .single();

  let campaignListId = campaign?.brevo_list_id;

  if (!campaignListId) {
    const listName = `Profunda Campaign ${campaignId.substring(0, 8)}`;

    const createRes = await fetch("https://api.brevo.com/v3/contacts/lists", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ name: listName, folderId: 1 }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      campaignListId = String(created.id);
    } else {
      const searchRes = await fetch("https://api.brevo.com/v3/contacts/lists?limit=50", {
        headers: { "api-key": brevoApiKey },
      });
      const searchData = await searchRes.json();
      // deno-lint-ignore no-explicit-any
      const found = (searchData.lists || []).find((l: any) => l.name === listName);
      if (found) {
        campaignListId = String(found.id);
      } else {
        throw new Error(`Could not create campaign list: ${listName}`);
      }
    }

    await supabaseAdmin
      .from("email_campaigns")
      .update({ brevo_list_id: campaignListId })
      .eq("id", campaignId);
  }

  const { data: audience } = await supabaseAdmin
    .from("email_campaign_audience")
    .select("email, name")
    .eq("campaign_id", campaignId);

  if (!audience?.length) {
    return { synced: 0, campaign_list_id: campaignListId!, metro_list_ids: [] };
  }

  const batchSize = 500;
  for (let i = 0; i < audience.length; i += batchSize) {
    const batch = audience.slice(i, i + batchSize);
    // deno-lint-ignore no-explicit-any
    const contacts = batch.map((a: any) => ({
      email: a.email,
      attributes: buildContactAttributes(a.name),
      listIds: [parseInt(campaignListId!)],
    }));

    await fetch("https://api.brevo.com/v3/contacts/import", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts,
        updateExistingContacts: true,
      }),
    });

    if (i + batchSize < audience.length) {
      await sleep(200);
    }
  }

  const metroListIds: string[] = [];
  if (definition.metro_ids?.length) {
    for (const metroId of definition.metro_ids) {
      try {
        const metroListId = await ensureMetroList(supabaseAdmin, brevoApiKey, metroId);
        metroListIds.push(metroListId);

        for (let i = 0; i < audience.length; i += batchSize) {
          const batch = audience.slice(i, i + batchSize);
          // deno-lint-ignore no-explicit-any
          const contacts = batch.map((a: any) => ({
            email: a.email,
            attributes: buildContactAttributes(a.name),
            listIds: [parseInt(metroListId)],
          }));

          await fetch("https://api.brevo.com/v3/contacts/import", {
            method: "POST",
            headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              contacts,
              updateExistingContacts: true,
            }),
          });

          if (i + batchSize < audience.length) {
            await sleep(200);
          }
        }
      } catch (e) {
        console.error(`Failed to sync metro list ${metroId}:`, e);
      }
    }
  }

  await supabaseAdmin.from("email_campaign_events").insert({
    campaign_id: campaignId,
    event_type: "synced_to_brevo",
    meta: { recipient_count: audience.length, campaign_list_id: campaignListId, metro_list_ids: metroListIds },
  });

  return { synced: audience.length, campaign_list_id: campaignListId!, metro_list_ids: metroListIds };
}

// deno-lint-ignore no-explicit-any
async function createBrevoEmailCampaign(
  supabaseAdmin: any,
  brevoApiKey: string,
  campaignId: string
): Promise<{ brevo_campaign_id: string }> {
  const { data: campaign } = await supabaseAdmin
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.brevo_list_id) throw new Error("Campaign list not synced");

  if (campaign.brevo_campaign_id) {
    return { brevo_campaign_id: campaign.brevo_campaign_id };
  }

  const res = await fetch("https://api.brevo.com/v3/emailCampaigns", {
    method: "POST",
    headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: campaign.name,
      subject: campaign.subject,
      preheader: campaign.preheader || undefined,
      htmlContent: campaign.html_body || "<p>{{params.content}}</p>",
      sender: {
        name: campaign.from_name || "CROS",
        email: campaign.from_email || "noreply@thecros.com",
      },
      replyTo: campaign.reply_to || campaign.from_email || "noreply@thecros.com",
      recipients: { listIds: [parseInt(campaign.brevo_list_id)] },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Brevo campaign: ${err}`);
  }

  const created = await res.json();
  const brevoCampaignId = String(created.id);

  await supabaseAdmin
    .from("email_campaigns")
    .update({ brevo_campaign_id: brevoCampaignId, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  await supabaseAdmin.from("email_campaign_events").insert({
    campaign_id: campaignId,
    event_type: "campaign_created",
    meta: { brevo_campaign_id: brevoCampaignId },
  });

  return { brevo_campaign_id: brevoCampaignId };
}

// deno-lint-ignore no-explicit-any
async function sendCampaign(
  supabaseAdmin: any,
  brevoApiKey: string,
  campaignId: string
): Promise<{ sent: boolean }> {
  const { data: campaign } = await supabaseAdmin
    .from("email_campaigns")
    .select("brevo_campaign_id")
    .eq("id", campaignId)
    .single();

  if (!campaign?.brevo_campaign_id) {
    throw new Error("Campaign not created in Brevo yet");
  }

  await supabaseAdmin
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", campaignId);

  const res = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaign.brevo_campaign_id}/sendNow`, {
    method: "POST",
    headers: { "api-key": brevoApiKey },
  });

  if (!res.ok) {
    await supabaseAdmin.from("email_campaigns").update({ status: "failed" }).eq("id", campaignId);
    const err = await res.text();
    throw new Error(`Failed to send campaign: ${err}`);
  }

  await supabaseAdmin
    .from("email_campaigns")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  await supabaseAdmin.from("email_campaign_events").insert({
    campaign_id: campaignId,
    event_type: "campaign_sent",
  });

  return { sent: true };
}

// deno-lint-ignore no-explicit-any
async function scheduleCampaign(
  supabaseAdmin: any,
  brevoApiKey: string,
  campaignId: string,
  scheduledAt: string
): Promise<{ scheduled: boolean }> {
  const { data: campaign } = await supabaseAdmin
    .from("email_campaigns")
    .select("brevo_campaign_id")
    .eq("id", campaignId)
    .single();

  if (!campaign?.brevo_campaign_id) {
    throw new Error("Campaign not created in Brevo yet");
  }

  const res = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaign.brevo_campaign_id}`, {
    method: "PUT",
    headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to schedule campaign: ${err}`);
  }

  await supabaseAdmin
    .from("email_campaigns")
    .update({ status: "scheduled", scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  await supabaseAdmin.from("email_campaign_events").insert({
    campaign_id: campaignId,
    event_type: "campaign_scheduled",
    meta: { scheduled_at: scheduledAt },
  });

  return { scheduled: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");

  if (!brevoApiKey) {
    return jsonError("BREVO_API_KEY missing", 500);
  }

  let requestBody: Record<string, unknown> = {};

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseClient.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      return jsonError("Unauthorized", 401);
    }

    const userId = claims.claims.sub as string;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // deno-lint-ignore no-explicit-any
    if (roles?.some((r: any) => r.role === "warehouse_manager")) {
      return jsonError("Access denied: warehouse managers cannot access email features", 403);
    }

    const { data: allowed } = await supabaseAdmin.rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_function_name: "brevo-campaign-sync",
      p_window_minutes: 1,
      p_max_requests: 30,
    });

    if (!allowed) {
      return jsonError("Rate limit exceeded", 429);
    }

    requestBody = await req.json();
    const { action, campaign_id, definition, manual_emails, scheduled_at } = requestBody;

    if (campaign_id) {
      const { data: campaign } = await supabaseAdmin
        .from("email_campaigns")
        .select("created_by")
        .eq("id", campaign_id)
        .single();

      // deno-lint-ignore no-explicit-any
      if (!campaign || (campaign as any).created_by !== userId) {
        return jsonError("Campaign not found or access denied", 403);
      }
    }

    switch (action) {
      case "build_audience": {
        if (!campaign_id) return jsonError("campaign_id required");
        const result = await buildAudience(
          supabaseAdmin,
          campaign_id as string,
          (definition || {}) as SegmentDefinition,
          manual_emails as string | undefined
        );
        return jsonResponse(result);
      }

      case "sync_to_brevo": {
        if (!campaign_id) return jsonError("campaign_id required");
        const result = await syncToBrevo(
          supabaseAdmin,
          brevoApiKey,
          campaign_id as string,
          (definition || {}) as SegmentDefinition
        );
        return jsonResponse(result);
      }

      case "create_campaign": {
        if (!campaign_id) return jsonError("campaign_id required");
        const result = await createBrevoEmailCampaign(supabaseAdmin, brevoApiKey, campaign_id as string);
        return jsonResponse(result);
      }

      case "send_campaign": {
        if (!campaign_id) return jsonError("campaign_id required");
        const result = await sendCampaign(supabaseAdmin, brevoApiKey, campaign_id as string);
        return jsonResponse(result);
      }

      case "schedule_campaign": {
        if (!campaign_id) return jsonError("campaign_id required");
        if (!scheduled_at) return jsonError("scheduled_at required");
        const result = await scheduleCampaign(
          supabaseAdmin,
          brevoApiKey,
          campaign_id as string,
          scheduled_at as string
        );
        return jsonResponse(result);
      }

      default:
        return jsonError("Invalid action");
    }
  } catch (e: unknown) {
    console.error("brevo-campaign-sync error:", e);
    const msg = e instanceof Error ? e.message : String(e);

    try {
      if (requestBody.campaign_id) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        await supabaseAdmin
          .from("email_campaigns")
          .update({ status: "failed" })
          .eq("id", requestBody.campaign_id);

        await supabaseAdmin.from("email_campaign_events").insert({
          campaign_id: requestBody.campaign_id,
          event_type: "failed",
          message: msg,
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    return jsonError(msg, 500);
  }
});
