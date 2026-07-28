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

function jsonError(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

interface PersonInput {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  organization?: string;
  url?: string;
  location?: string;
  search_result_id?: string;
}

interface RequestBody {
  people: PersonInput[];
  metro_id?: string;
  idempotency_key?: string;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Only POST is accepted", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError("UNAUTHORIZED", "Missing Authorization header", 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be valid JSON", 400);
  }

  if (!Array.isArray(body.people) || body.people.length === 0) {
    return jsonError("INVALID_PAYLOAD", "people: required non-empty array", 400);
  }
  if (body.people.length > 50) {
    return jsonError("INVALID_PAYLOAD", "people: max 50 per request", 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Idempotency check
  if (body.idempotency_key) {
    const { data: existing } = await admin
      .from("email_campaigns")
      .select("id")
      .eq("metadata->>idempotency_key", body.idempotency_key)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ ok: true, duplicate: true, campaign_id: existing.id });
    }
  }

  const createdContacts: { id: string; name: string; email: string | null; opportunity_id: string | null }[] = [];
  const createdOpportunities = new Map<string, string>(); // org name -> opp id

  try {
    for (const person of body.people) {
      if (!person.name?.trim()) continue;

      let oppId: string | null = null;

      // Find or create opportunity by organization name
      if (person.organization?.trim()) {
        const orgKey = person.organization.trim().toLowerCase();

        if (createdOpportunities.has(orgKey)) {
          oppId = createdOpportunities.get(orgKey)!;
        } else {
          // Check if org exists
          const { data: existingOpp } = await admin
            .from("opportunities")
            .select("id")
            .ilike("organization", orgKey)
            .limit(1)
            .maybeSingle();

          if (existingOpp) {
            oppId = existingOpp.id;
          } else {
            // Create new opportunity
            const { data: newOpp, error: oppErr } = await admin
              .from("opportunities")
              .insert({
                organization: person.organization.trim(),
                opportunity_id: crypto.randomUUID().slice(0, 8),
                website_url: person.url || null,
                metro_id: body.metro_id || null,
                stage: "Target Identified",
                status: "Active",
              })
              .select("id")
              .single();

            if (oppErr) {
              console.error("Failed to create opportunity:", oppErr);
              continue;
            }
            oppId = newOpp.id;

            // Trigger enrichment if URL available — awaited with 10s timeout
            if (person.url) {
              try {
                const enrichRes = await fetch(`${supabaseUrl}/functions/v1/opportunity-auto-enrich`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                  },
                  body: JSON.stringify({
                    opportunity_id: oppId,
                    source_url: person.url,
                    idempotency_key: `auto-enrich-draft-${oppId}`,
                  }),
                  signal: AbortSignal.timeout(10000),
                });
                console.log(`[add-and-draft] Auto-enrich for ${oppId}: status=${enrichRes.status}`);
                await enrichRes.text();
              } catch (enrichErr) {
                console.error(`[add-and-draft] Auto-enrich failed for ${oppId}:`, enrichErr);
              }
            }
          }

          createdOpportunities.set(orgKey, oppId);
        }
      }

      // Check for existing contact by email (dedup)
      if (person.email?.trim()) {
        const { data: existingContact } = await admin
          .from("contacts")
          .select("id")
          .eq("email", person.email.trim().toLowerCase())
          .maybeSingle();

        if (existingContact) {
          createdContacts.push({
            id: existingContact.id,
            name: person.name.trim(),
            email: person.email.trim(),
            opportunity_id: oppId,
          });
          continue;
        }
      }

      // Create contact
      const { data: newContact, error: contactErr } = await admin
        .from("contacts")
        .insert({
          name: person.name.trim(),
          contact_id: crypto.randomUUID().slice(0, 8),
          title: person.title || null,
          email: person.email?.trim() || null,
          phone: person.phone || null,
          opportunity_id: oppId,
          created_by: userId,
        })
        .select("id")
        .single();

      if (contactErr) {
        console.error("Failed to create contact:", contactErr);
        continue;
      }

      createdContacts.push({
        id: newContact.id,
        name: person.name.trim(),
        email: person.email?.trim() || null,
        opportunity_id: oppId,
      });

      // Mark search result as added
      if (person.search_result_id) {
        await admin
          .from("search_results")
          .update({
            entity_created: true,
            created_entity_id: newContact.id,
            created_entity_type: "contact",
          })
          .eq("id", person.search_result_id);
      }
    }

    // Create draft campaign with contacts that have emails
    const withEmail = createdContacts.filter(c => c.email);

    if (withEmail.length === 0) {
      return jsonResponse({
        ok: true,
        contacts_created: createdContacts.length,
        opportunities_created: createdOpportunities.size,
        campaign_id: null,
        message: "Contacts added but none have email addresses for campaign",
      });
    }

    // Create campaign
    const { data: campaign, error: campaignErr } = await admin
      .from("email_campaigns")
      .insert({
        name: `Outreach Draft - ${new Date().toLocaleDateString()}`,
        subject: "Partnership Opportunity",
        status: "draft",
        created_by: userId,
        audience_count: withEmail.length,
        metadata: {
          source: "add_and_draft_outreach",
          idempotency_key: body.idempotency_key || null,
        },
      })
      .select("id")
      .single();

    if (campaignErr) {
      return jsonError("CAMPAIGN_ERROR", `Failed to create campaign: ${campaignErr.message}`, 500);
    }

    // Add audience
    const audienceRows = withEmail.map(c => ({
      campaign_id: campaign.id,
      email: c.email!,
      name: c.name,
      contact_id: c.id,
      opportunity_id: c.opportunity_id,
      source: "add_and_draft",
      status: "pending",
    }));

    await admin.from("email_campaign_audience").insert(audienceRows);

    return jsonResponse({
      ok: true,
      contacts_created: createdContacts.length,
      opportunities_created: createdOpportunities.size,
      campaign_id: campaign.id,
      audience_count: withEmail.length,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonError("INTERNAL_ERROR", "Internal error", 500);
  }
}

Deno.serve(handleRequest);
