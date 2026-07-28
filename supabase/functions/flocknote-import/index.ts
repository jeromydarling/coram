import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  rescueFailedRows,
  describeFailure,
  type FailedMigrationRow,
} from "../_shared/migrationAiRescue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── CSV parsing ──────────────────────────────────────────────

function parseCsv(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = raw.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = vals[j] ?? "";
    rows.push(row);
  }
  return { headers, rows };
}

// ── Header normalisation (mirrors src/utils/normalizeCsvColumns.ts) ──

const PEOPLE_ALIASES: Record<string, string> = {
  id: "external_id", "external id": "external_id", external_id: "external_id", "person id": "external_id",
  "first name": "first_name", firstname: "first_name", first: "first_name", first_name: "first_name",
  "last name": "last_name", lastname: "last_name", last: "last_name", last_name: "last_name",
  email: "email", "email address": "email", "e-mail": "email", "primary email": "email",
  phone: "phone", "mobile phone": "phone", cell: "phone", "cell phone": "phone", "primary phone": "phone",
  "street address": "address", address: "address", "address 1": "address", street: "address",
  city: "city", state: "state",
  "postal code": "zip", zip: "zip", "zip code": "zip",
};

const MEMBERSHIP_ALIASES: Record<string, string> = {
  group: "group_name", "group name": "group_name", group_name: "group_name", ministry: "group_name",
  email_or_phone: "email_or_phone", "email or phone": "email_or_phone", member: "email_or_phone",
  "member contact": "email_or_phone", email: "email_or_phone", phone: "email_or_phone",
};

function normalizeKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeHeaders(rawHeaders: string[], aliases: Record<string, string>) {
  const headerMap: Record<string, string> = {};
  const unknownHeaders: string[] = [];
  for (const h of rawHeaders) {
    const c = aliases[normalizeKey(h)];
    if (c) headerMap[h] = c;
    else unknownHeaders.push(h);
  }
  return { headerMap, unknownHeaders };
}

function mapRow(row: Record<string, string>, headerMap: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [orig, val] of Object.entries(row)) {
    const canon = headerMap[orig];
    if (canon) out[canon] = val;
  }
  return out;
}

// ── Phone normalisation for matching ──
function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").slice(-10);
}

function isPhone(s: string): boolean {
  return /^\d[\d\-\s().]+$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    // Check admin or regional_lead role (tenant admins can import)
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "regional_lead"])
      .limit(1);

    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: admin or regional_lead role required" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { mode, tenant_id, people_csv, memberships_csv } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: corsHeaders });
    }
    if (!people_csv) {
      return new Response(JSON.stringify({ error: "people_csv required" }), { status: 400, headers: corsHeaders });
    }
    if (!["dry_run", "commit"].includes(mode)) {
      return new Response(JSON.stringify({ error: "mode must be dry_run or commit" }), { status: 400, headers: corsHeaders });
    }

    // ── Parse & normalise people ──
    const peopleParsed = parseCsv(people_csv);
    const peopleNorm = normalizeHeaders(peopleParsed.headers, PEOPLE_ALIASES);
    const mappedPeople = peopleParsed.rows.map((r) => mapRow(r, peopleNorm.headerMap));

    // Validate: need at least email or phone
    const validPeople = mappedPeople.filter((p) => p.email || p.phone);
    const skippedPeople = mappedPeople.length - validPeople.length;

    // ── Parse & normalise memberships ──
    let mappedMemberships: Record<string, string>[] = [];
    let membershipNorm = { headerMap: {} as Record<string, string>, unknownHeaders: [] as string[] };
    if (memberships_csv) {
      const memParsed = parseCsv(memberships_csv);
      membershipNorm = normalizeHeaders(memParsed.headers, MEMBERSHIP_ALIASES);
      mappedMemberships = memParsed.rows.map((r) => mapRow(r, membershipNorm.headerMap));
    }

    // Detect unique groups
    const groupNames = [...new Set(mappedMemberships.map((m) => m.group_name).filter(Boolean))];

    // ── DRY RUN ──
    if (mode === "dry_run") {
      // Detect duplicates by email
      const emails = validPeople.map((p) => p.email).filter(Boolean);
      const emailSet = new Set<string>();
      let duplicatesDetected = 0;
      for (const e of emails) {
        if (emailSet.has(e)) duplicatesDetected++;
        else emailSet.add(e);
      }

      return new Response(JSON.stringify({
        ok: true,
        mode: "dry_run",
        counts: {
          rows_read: peopleParsed.rows.length,
          people_mapped: validPeople.length,
          memberships_mapped: mappedMemberships.length,
          groups_detected: groupNames.length,
          skipped_missing_keys: skippedPeople,
          duplicates_detected: duplicatesDetected,
        },
        preview: {
          people: validPeople.slice(0, 10),
          memberships: mappedMemberships.slice(0, 10),
        },
        warnings: [
          ...(skippedPeople > 0 ? [`${skippedPeople} rows skipped (no email or phone)`] : []),
          ...peopleNorm.unknownHeaders.map((h) => `Unknown people column: "${h}"`),
          ...membershipNorm.unknownHeaders.map((h) => `Unknown membership column: "${h}"`),
        ],
        header_map: {
          people: peopleNorm.headerMap,
          memberships: membershipNorm.headerMap,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── COMMIT ──
    const results = { people_created: 0, people_updated: 0, people_skipped: 0, groups_created: 0, memberships_created: 0, memberships_skipped: 0 };
    const warnings: string[] = [];
    const failedForRescue: FailedMigrationRow[] = [];

    // Build a map email→contact for membership linking
    const contactByEmail: Record<string, string> = {}; // email → contact.id
    const contactByPhone: Record<string, string> = {}; // normalizedPhone → contact.id

    for (const person of validPeople) {
      const email = person.email?.toLowerCase().trim();
      const phone = person.phone?.trim();
      const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown";

      // Build external_ids
      const externalIds: Record<string, string> = {};
      if (person.external_id) externalIds["flocknote"] = person.external_id;

      // Try to find existing contact by email
      let existingId: string | null = null;
      if (email) {
        const { data: existing } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("email", email)
          .maybeSingle();
        if (existing) existingId = existing.id;
      }

      // Fallback: try phone match
      if (!existingId && phone) {
        const { data: existing } = await supabaseAdmin
          .from("contacts")
          .select("id, phone")
          .eq("tenant_id", tenant_id)
          .not("phone", "is", null)
          .limit(500);
        if (existing) {
          const normalizedInput = normalizePhone(phone);
          const match = existing.find((c) => c.phone && normalizePhone(c.phone) === normalizedInput);
          if (match) existingId = match.id;
        }
      }

      if (existingId) {
        // Update existing
        await supabaseAdmin.from("contacts").update({
          name,
          title: person.title || undefined,
          phone: phone || undefined,
          notes: person.address ? `Address: ${[person.address, person.city, person.state, person.zip].filter(Boolean).join(", ")}` : undefined,
          external_ids: externalIds,
          updated_at: new Date().toISOString(),
        }).eq("id", existingId);
        results.people_updated++;
        if (email) contactByEmail[email] = existingId;
        if (phone) contactByPhone[normalizePhone(phone)] = existingId;
      } else {
        // Insert new contact
        const contactId = `FN-${person.external_id || crypto.randomUUID().slice(0, 8)}`;
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("contacts")
          .insert({
            contact_id: contactId,
            tenant_id,
            name,
            email: email || null,
            phone: phone || null,
            notes: person.address ? `Address: ${[person.address, person.city, person.state, person.zip].filter(Boolean).join(", ")}` : null,
            external_ids: externalIds,
          })
          .select("id")
          .single();

        if (insertErr) {
          // Likely a duplicate or schema mismatch — skip and forward to AI rescue.
          results.people_skipped++;
          warnings.push(`Skipped contact insert for ${email || phone}: ${insertErr.message}`);
          // Don't forward unique-violation noise (duplicates aren't rescuable).
          if (insertErr.code !== "23505") {
            failedForRescue.push({
              source_row: person,
              target_entity: "people",
              failure_reason: describeFailure(insertErr, "Contact insert failed"),
            });
          }
        } else {
          results.people_created++;
          if (email) contactByEmail[email] = inserted.id;
          if (phone) contactByPhone[normalizePhone(phone)] = inserted.id;
        }
      }
    }

    // ── Groups & memberships ──
    const groupIdMap: Record<string, string> = {}; // group_name → group.id

    for (const gn of groupNames) {
      const { data: existing } = await supabaseAdmin
        .from("people_groups")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("group_name", gn)
        .maybeSingle();

      if (existing) {
        groupIdMap[gn] = existing.id;
      } else {
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("people_groups")
          .insert({ tenant_id, group_name: gn, source_connector: "flocknote" })
          .select("id")
          .single();

        if (insertErr) {
          warnings.push(`Group insert error for "${gn}": ${insertErr.message}`);
        } else {
          results.groups_created++;
          groupIdMap[gn] = inserted.id;
        }
      }
    }

    // Memberships
    for (const mem of mappedMemberships) {
      const groupId = groupIdMap[mem.group_name];
      if (!groupId) {
        warnings.push(`No group found for membership: ${mem.group_name}`);
        continue;
      }

      const identifier = mem.email_or_phone?.trim();
      if (!identifier) continue;

      // Resolve to contact_id
      let contactId: string | undefined;
      if (isPhone(identifier)) {
        contactId = contactByPhone[normalizePhone(identifier)];
      } else {
        contactId = contactByEmail[identifier.toLowerCase()];
      }

      if (!contactId) {
        // Try DB lookup
        if (isPhone(identifier)) {
          const { data: contacts } = await supabaseAdmin
            .from("contacts")
            .select("id, phone")
            .eq("tenant_id", tenant_id)
            .not("phone", "is", null)
            .limit(500);
          const match = contacts?.find((c) => c.phone && normalizePhone(c.phone) === normalizePhone(identifier));
          contactId = match?.id;
        } else {
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("email", identifier.toLowerCase())
            .maybeSingle();
          contactId = contact?.id;
        }
      }

      if (!contactId) {
        warnings.push(`Could not resolve membership contact: ${identifier}`);
        results.memberships_skipped++;
        continue;
      }

      const { error: memErr } = await supabaseAdmin
        .from("people_group_memberships")
        .insert({ group_id: groupId, contact_id: contactId })
        .select("id")
        .single();

      if (memErr) {
        if (memErr.code === "23505") {
          // Unique constraint — already exists
          results.memberships_skipped++;
        } else {
          warnings.push(`Membership insert error: ${memErr.message}`);
          results.memberships_skipped++;
        }
      } else {
        results.memberships_created++;
      }
    }

    // Record migration run
    const { data: syncJob } = await supabaseAdmin.from("relatio_sync_jobs").insert({
      tenant_id,
      connector_key: "flocknote",
      direction: "import",
      mode: "commit",
      status: "completed",
      summary: {
        results,
        warnings,
        people_header_map: peopleNorm.headerMap,
        membership_header_map: membershipNorm.headerMap,
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).select("id").single();

    // AI rescue — fire after deterministic repair has failed.
    const rescue = await rescueFailedRows({
      migration_id: syncJob?.id ?? crypto.randomUUID(),
      tenant_id,
      integration_key: "flocknote",
      failed_rows: failedForRescue,
    });

    return new Response(JSON.stringify({
      ok: true,
      mode: "commit",
      results,
      warnings,
      ai_rescue: rescue,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
