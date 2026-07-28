/**
 * relatio-dry-run — Previews a migration without writing to CRM tables.
 * POST { tenant_id, connector_key, source, records? }
 *
 * Returns mapping preview, warnings, and sample records.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Default field maps per connector — covers all 31 registered connectors */
const DEFAULT_MAPS: Record<string, { source: string; target: string; object: string }[]> = {
  // ── Full Custom Adapters ──
  salesforce: [
    { source: "Account.Name", target: "organization", object: "organizations" },
    { source: "Account.Website", target: "website_url", object: "organizations" },
    { source: "Account.BillingCity", target: "city", object: "organizations" },
    { source: "Account.BillingState", target: "state", object: "organizations" },
    { source: "Account.Industry", target: "industry", object: "organizations" },
    { source: "Contact.FirstName+LastName", target: "name", object: "contacts" },
    { source: "Contact.Email", target: "email", object: "contacts" },
    { source: "Contact.Title", target: "title", object: "contacts" },
    { source: "Task.Subject", target: "title", object: "tasks" },
    { source: "Event.Subject", target: "event_name", object: "events" },
    { source: "Note.Title", target: "title", object: "activities" },
  ],
  dynamics365: [
    { source: "account.name", target: "organization", object: "organizations" },
    { source: "account.websiteurl", target: "website_url", object: "organizations" },
    { source: "account.telephone1", target: "phone", object: "organizations" },
    { source: "account.address1_city", target: "city", object: "organizations" },
    { source: "contact.firstname+lastname", target: "name", object: "contacts" },
    { source: "contact.emailaddress1", target: "email", object: "contacts" },
    { source: "contact.jobtitle", target: "title", object: "contacts" },
    { source: "task.subject", target: "title", object: "tasks" },
    { source: "appointment.subject", target: "event_name", object: "events" },
    { source: "activity.subject", target: "title", object: "activities" },
  ],
  civicrm: [
    { source: "organization_name", target: "organization", object: "organizations" },
    { source: "website_primary.url", target: "website_url", object: "organizations" },
    { source: "display_name", target: "name", object: "contacts" },
    { source: "email_primary.email", target: "email", object: "contacts" },
    { source: "phone_primary.phone", target: "phone", object: "contacts" },
    { source: "job_title", target: "title", object: "contacts" },
    { source: "subject", target: "title", object: "activities" },
    { source: "activity_date_time", target: "date", object: "activities" },
    { source: "title", target: "event_name", object: "events" },
    { source: "start_date", target: "start_date", object: "events" },
    { source: "total_amount", target: "amount", object: "giving" },
    { source: "receive_date", target: "date", object: "giving" },
  ],
  airtable: [
    { source: "Organization Name / Name", target: "organization", object: "organizations" },
    { source: "Website", target: "website_url", object: "organizations" },
    { source: "FirstName+LastName", target: "name", object: "contacts" },
    { source: "Email", target: "email", object: "contacts" },
    { source: "Phone", target: "phone", object: "contacts" },
  ],
  fluentcrm: [
    { source: "company.name", target: "organization", object: "organizations" },
    { source: "company.website", target: "website_url", object: "organizations" },
    { source: "subscriber.first_name+last_name", target: "name", object: "contacts" },
    { source: "subscriber.email", target: "email", object: "contacts" },
    { source: "subscriber.phone", target: "phone", object: "contacts" },
  ],
  jetpackcrm: [
    { source: "company.name", target: "organization", object: "organizations" },
    { source: "company.homeurl", target: "website_url", object: "organizations" },
    { source: "customer.fname+lname", target: "name", object: "contacts" },
    { source: "customer.email", target: "email", object: "contacts" },
    { source: "transaction.title", target: "title", object: "tasks" },
  ],
  wperp: [
    { source: "company.company", target: "organization", object: "organizations" },
    { source: "company.website", target: "website_url", object: "organizations" },
    { source: "contact.first_name+last_name", target: "name", object: "contacts" },
    { source: "contact.email", target: "email", object: "contacts" },
    { source: "activity.title/message", target: "title", object: "activities" },
  ],
  // ── Outbound-Capable (with stub inbound) ──
  hubspot: [
    { source: "company.name", target: "organization", object: "organizations" },
    { source: "company.domain", target: "website_url", object: "organizations" },
    { source: "contact.firstname+lastname", target: "name", object: "contacts" },
    { source: "contact.email", target: "email", object: "contacts" },
    { source: "engagement.body", target: "notes", object: "activities" },
    { source: "deal.dealname", target: "title", object: "tasks" },
  ],
  blackbaud: [
    { source: "constituent.name", target: "organization", object: "organizations" },
    { source: "constituent.email.address", target: "email", object: "contacts" },
    { source: "constituent.first+last", target: "name", object: "contacts" },
    { source: "gift.amount", target: "amount", object: "giving" },
    { source: "gift.date", target: "date", object: "giving" },
    { source: "action.description", target: "title", object: "activities" },
  ],
  // ── Donor CRM Connectors ──
  bloomerang: [
    { source: "constituent.FullName", target: "name", object: "contacts" },
    { source: "constituent.PrimaryEmail", target: "email", object: "contacts" },
    { source: "constituent.Organization", target: "organization", object: "organizations" },
    { source: "donation.Amount", target: "amount", object: "giving" },
    { source: "donation.Date", target: "date", object: "giving" },
    { source: "interaction.Note", target: "title", object: "activities" },
  ],
  neoncrm: [
    { source: "account.name", target: "organization", object: "organizations" },
    { source: "account.email", target: "email", object: "contacts" },
    { source: "donation.amount", target: "amount", object: "giving" },
    { source: "donation.donationDate", target: "date", object: "giving" },
    { source: "event.name", target: "event_name", object: "events" },
  ],
  donorperfect: [
    { source: "donor.first_name+last_name", target: "name", object: "contacts" },
    { source: "donor.email", target: "email", object: "contacts" },
    { source: "gift.amount", target: "amount", object: "giving" },
    { source: "gift.gift_date", target: "date", object: "giving" },
    { source: "gift.gl_code", target: "fund", object: "giving" },
  ],
  lgl: [
    { source: "constituent.name", target: "name", object: "contacts" },
    { source: "constituent.email", target: "email", object: "contacts" },
    { source: "gift.amount", target: "amount", object: "giving" },
    { source: "gift.received_on", target: "date", object: "giving" },
    { source: "gift.campaign_name", target: "campaign", object: "giving" },
  ],
  kindful: [
    { source: "contact.name", target: "name", object: "contacts" },
    { source: "contact.email", target: "email", object: "contacts" },
    { source: "transaction.amount", target: "amount", object: "giving" },
    { source: "transaction.date", target: "date", object: "giving" },
    { source: "campaign.name", target: "campaign", object: "giving" },
  ],
  virtuous: [
    { source: "contact.name", target: "name", object: "contacts" },
    { source: "contact.email", target: "email", object: "contacts" },
    { source: "gift.amount", target: "amount", object: "giving" },
    { source: "gift.giftDate", target: "date", object: "giving" },
    { source: "project.name", target: "project", object: "activities" },
  ],
  wildapricot: [
    { source: "contact.Name", target: "name", object: "contacts" },
    { source: "contact.Email", target: "email", object: "contacts" },
    { source: "membership.Level", target: "membership_level", object: "contacts" },
    { source: "donation.Amount", target: "amount", object: "giving" },
    { source: "event.Name", target: "event_name", object: "events" },
  ],
  // ── ChMS Connectors ──
  planningcenter: [
    { source: "person.first_name+last_name", target: "name", object: "contacts" },
    { source: "person.emails[0]", target: "email", object: "contacts" },
    { source: "household.name", target: "organization", object: "organizations" },
    { source: "event.name", target: "event_name", object: "events" },
    { source: "check_in.created_at", target: "date", object: "activities" },
  ],
  rock: [
    { source: "person.FirstName+LastName", target: "name", object: "contacts" },
    { source: "person.Email", target: "email", object: "contacts" },
    { source: "family.Name", target: "organization", object: "organizations" },
    { source: "group.Name", target: "group_name", object: "activities" },
    { source: "event.Name", target: "event_name", object: "events" },
  ],
  breeze: [
    { source: "person.first_name+last_name", target: "name", object: "contacts" },
    { source: "person.email", target: "email", object: "contacts" },
    { source: "family.name", target: "organization", object: "organizations" },
    { source: "event.name", target: "event_name", object: "events" },
    { source: "tag.name", target: "tag", object: "contacts" },
  ],
  fellowshipone: [
    { source: "person.firstName+lastName", target: "name", object: "contacts" },
    { source: "person.email", target: "email", object: "contacts" },
    { source: "household.householdName", target: "organization", object: "organizations" },
    { source: "activity.activityName", target: "title", object: "activities" },
  ],
  pushpay: [
    { source: "person.firstName+lastName", target: "name", object: "contacts" },
    { source: "person.primaryEmail", target: "email", object: "contacts" },
    { source: "group.name", target: "group_name", object: "activities" },
    { source: "event.name", target: "event_name", object: "events" },
    { source: "giving.amount", target: "amount", object: "giving" },
  ],
  parishsoft: [
    { source: "member.FirstName+LastName", target: "name", object: "contacts" },
    { source: "member.Email", target: "email", object: "contacts" },
    { source: "family.FamilyName", target: "organization", object: "organizations" },
    { source: "contribution.Amount", target: "amount", object: "giving" },
  ],
  ministryplatform: [
    { source: "contact.Display_Name", target: "name", object: "contacts" },
    { source: "contact.Email_Address", target: "email", object: "contacts" },
    { source: "household.Household_Name", target: "organization", object: "organizations" },
    { source: "event.Event_Title", target: "event_name", object: "events" },
  ],
  // ── General CRM Connectors ──
  zoho: [
    { source: "contact.First_Name+Last_Name", target: "name", object: "contacts" },
    { source: "contact.Email", target: "email", object: "contacts" },
    { source: "account.Account_Name", target: "organization", object: "organizations" },
    { source: "deal.Deal_Name", target: "title", object: "tasks" },
    { source: "activity.Subject", target: "title", object: "activities" },
  ],
  oracle: [
    { source: "contact.FirstName+LastName", target: "name", object: "contacts" },
    { source: "contact.EmailAddress", target: "email", object: "contacts" },
    { source: "account.OrganizationName", target: "organization", object: "organizations" },
    { source: "opportunity.Name", target: "title", object: "tasks" },
    { source: "activity.Subject", target: "title", object: "activities" },
  ],
  // ── Personal Contact Connectors ──
  google_contacts: [
    { source: "person.names[0].displayName", target: "name", object: "contacts" },
    { source: "person.emailAddresses[0].value", target: "email", object: "contacts" },
    { source: "person.phoneNumbers[0].value", target: "phone", object: "contacts" },
    { source: "person.organizations[0].name", target: "organization", object: "organizations" },
  ],
  outlook_contacts: [
    { source: "contact.displayName", target: "name", object: "contacts" },
    { source: "contact.emailAddresses[0].address", target: "email", object: "contacts" },
    { source: "contact.mobilePhone", target: "phone", object: "contacts" },
    { source: "contact.companyName", target: "organization", object: "organizations" },
  ],
  apple_contacts: [
    { source: "vCard.FN", target: "name", object: "contacts" },
    { source: "vCard.EMAIL", target: "email", object: "contacts" },
    { source: "vCard.TEL", target: "phone", object: "contacts" },
    { source: "vCard.ORG", target: "organization", object: "organizations" },
  ],
  monicacrm: [
    { source: "contact.first_name+last_name", target: "name", object: "contacts" },
    { source: "contact.email", target: "email", object: "contacts" },
    { source: "activity.summary", target: "title", object: "activities" },
    { source: "reminder.title", target: "title", object: "tasks" },
  ],
  contactsplus: [
    { source: "contact.name", target: "name", object: "contacts" },
    { source: "contact.email", target: "email", object: "contacts" },
    { source: "contact.company", target: "organization", object: "organizations" },
    { source: "note.content", target: "notes", object: "activities" },
  ],
  // ── WordPress CRM (already have full adapters) ──
  // fluentcrm, jetpackcrm, wperp defined above
  // ── CSV-only / manual ──
  shelbynext: [
    { source: "member.Name", target: "name", object: "contacts" },
    { source: "member.Email", target: "email", object: "contacts" },
    { source: "family.FamilyName", target: "organization", object: "organizations" },
    { source: "contribution.Amount", target: "amount", object: "giving" },
  ],
  servantkeeper: [
    { source: "member.Name", target: "name", object: "contacts" },
    { source: "member.Email", target: "email", object: "contacts" },
    { source: "family.FamilyName", target: "organization", object: "organizations" },
    { source: "contribution.Amount", target: "amount", object: "giving" },
  ],
  csv: [
    { source: "organization", target: "organization", object: "organizations" },
    { source: "email", target: "email", object: "contacts" },
    { source: "name", target: "name", object: "contacts" },
    { source: "phone", target: "phone", object: "contacts" },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tenant_id, connector_key, records } = await req.json();

    if (!tenant_id || !connector_key) {
      return new Response(
        JSON.stringify({ error: "tenant_id and connector_key are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldMaps = DEFAULT_MAPS[connector_key] || DEFAULT_MAPS["csv"];
    const inputRecords = Array.isArray(records) ? records : [];
    const warnings: string[] = [];

    // Count by object type
    const previewCounts: Record<string, number> = {};
    const sampleRecords: Record<string, unknown[]> = {};
    const objectTypes = [...new Set(fieldMaps.map((m) => m.object))];

    for (const objType of objectTypes) {
      previewCounts[objType] = inputRecords.length > 0
        ? inputRecords.filter(() => true).length // Each record maps to each object type
        : 0;
      sampleRecords[objType] = inputRecords.slice(0, 3);
    }

    if (inputRecords.length > 50000) {
      warnings.push("CSV exceeds 50,000 rows. Only the first 50,000 will be processed.");
    }

    if (inputRecords.length === 0) {
      warnings.push(
        "No records provided. For API-based connectors, records will be pulled during commit.",
      );
    }

    // Create dry_run sync job
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job, error: jobErr } = await admin
      .from("relatio_sync_jobs")
      .insert({
        tenant_id,
        connector_key,
        direction: "pull",
        mode: "dry_run",
        status: "completed",
        summary: { preview_counts: previewCounts, warnings, field_maps: fieldMaps },
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobErr) {
      return new Response(JSON.stringify({ error: jobErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sync_job_id: job.id,
        preview_counts: previewCounts,
        warnings,
        field_maps: fieldMaps,
        sample_records: sampleRecords,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
