/**
 * companion-absorb — Processes a Companion's decision to join a tenant.
 *
 * WHAT: Handles the full absorption flow: validates invite, adds user to tenant,
 *       and optionally moves or copies selected relationships.
 * WHERE: Called from the Organizations settings tab when accepting an invitation.
 * WHY: Companions must explicitly choose how to handle existing relationships
 *       when joining an organization — never auto-transferred.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { ok: false, error: "unauthorized" });
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json(401, { ok: false, error: "unauthorized" });

  const svc = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const {
      invite_id,
      relationship_strategy = "private",
      selected_opportunity_ids = [],
      selected_contact_ids = [],
    } = body;

    // Validate strategy
    if (!["private", "move", "copy"].includes(relationship_strategy)) {
      return json(400, { ok: false, error: "Invalid relationship strategy. Choose: private, move, or copy." });
    }

    // Validate invite
    if (!invite_id) {
      return json(400, { ok: false, error: "invite_id is required" });
    }

    const { data: invite, error: inviteErr } = await svc
      .from("tenant_invites")
      .select("id, tenant_id, email, ministry_role, accepted_at, revoked_at, expires_at")
      .eq("id", invite_id)
      .single();

    if (inviteErr || !invite) {
      return json(404, { ok: false, error: "Invitation not found" });
    }

    if (invite.accepted_at) {
      return json(400, { ok: false, error: "This invitation has already been accepted." });
    }
    if (invite.revoked_at) {
      return json(400, { ok: false, error: "This invitation has been revoked." });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return json(400, { ok: false, error: "This invitation has expired." });
    }

    // Verify email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return json(403, { ok: false, error: "This invitation was sent to a different email address." });
    }

    const targetTenantId = invite.tenant_id;

    // Check not already a member
    const { data: existingMembership } = await svc
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", targetTenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMembership) {
      // Mark invite as accepted and return success
      await svc.from("tenant_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite_id);
      return json(200, { ok: true, message: "You're already part of this organization.", already_member: true });
    }

    // Find the user's personal (source) tenant
    const { data: userTenants } = await svc
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id);

    // Get source tenant (caregiver_solo)
    let sourceTenantId: string | null = null;
    if (userTenants?.length) {
      const tenantIds = userTenants.map(t => t.tenant_id);
      const { data: soloTenants } = await svc
        .from("tenants")
        .select("id")
        .in("id", tenantIds)
        .eq("archetype", "caregiver_solo")
        .limit(1);
      sourceTenantId = soloTenants?.[0]?.id || userTenants[0].tenant_id;
    }

    // Create absorption request
    const { data: absorptionReq, error: absErr } = await svc
      .from("companion_absorption_requests")
      .insert({
        user_id: user.id,
        source_tenant_id: sourceTenantId || targetTenantId,
        target_tenant_id: targetTenantId,
        invite_id: invite_id,
        relationship_strategy,
        selected_opportunity_ids: selected_opportunity_ids || [],
        selected_contact_ids: selected_contact_ids || [],
        status: "processing",
      })
      .select("id")
      .single();

    if (absErr) {
      console.error("Absorption request insert error:", absErr);
      return json(500, { ok: false, error: "Failed to process your request." });
    }

    // Add user to target tenant
    const { error: joinErr } = await svc
      .from("tenant_users")
      .insert({
        tenant_id: targetTenantId,
        user_id: user.id,
        role: invite.ministry_role || "companion",
        joined_from_companion: true,
        absorption_request_id: absorptionReq.id,
      });

    if (joinErr) {
      console.error("Join tenant error:", joinErr);
      await svc.from("companion_absorption_requests")
        .update({ status: "failed", error_message: joinErr.message })
        .eq("id", absorptionReq.id);
      return json(500, { ok: false, error: "Failed to join the organization." });
    }

    // Process relationship handling
    let movedOpps = 0, copiedOpps = 0, movedContacts = 0, copiedContacts = 0;

    if (relationship_strategy === "move" && sourceTenantId) {
      // Move selected opportunities
      if (selected_opportunity_ids.length > 0) {
        const { data: updated } = await svc
          .from("opportunities")
          .update({
            tenant_id: targetTenantId,
            origin_type: "moved",
            source_user_id: user.id,
          })
          .in("id", selected_opportunity_ids)
          .eq("tenant_id", sourceTenantId)
          .select("id");
        movedOpps = updated?.length || 0;
      }

      // Move selected contacts
      if (selected_contact_ids.length > 0) {
        const { data: updated } = await svc
          .from("contacts")
          .update({
            tenant_id: targetTenantId,
            origin_type: "moved",
            source_user_id: user.id,
          })
          .in("id", selected_contact_ids)
          .eq("tenant_id", sourceTenantId)
          .select("id");
        movedContacts = updated?.length || 0;
      }
    } else if (relationship_strategy === "copy" && sourceTenantId) {
      // Copy selected opportunities
      if (selected_opportunity_ids.length > 0) {
        const { data: originals } = await svc
          .from("opportunities")
          .select("opportunity_id, organization, stage, status, notes, metro_id, city, contact_name, contact_email, contact_phone")
          .in("id", selected_opportunity_ids)
          .eq("tenant_id", sourceTenantId);

        if (originals?.length) {
          const copies = originals.map((o: any, i: number) => ({
            opportunity_id: `COPY-${Date.now()}-${i}`,
            organization: o.organization,
            stage: o.stage || "Discovery",
            status: o.status || "Active",
            notes: o.notes,
            metro_id: o.metro_id,
            city: o.city,
            contact_name: o.contact_name,
            contact_email: o.contact_email,
            contact_phone: o.contact_phone,
            tenant_id: targetTenantId,
            origin_type: "copied",
            source_opportunity_id: selected_opportunity_ids[i],
            source_user_id: user.id,
          }));
          const { data: inserted } = await svc.from("opportunities").insert(copies).select("id");
          copiedOpps = inserted?.length || 0;
        }
      }

      // Copy selected contacts
      if (selected_contact_ids.length > 0) {
        const { data: originals } = await svc
          .from("contacts")
          .select("contact_id, name, email, phone, notes")
          .in("id", selected_contact_ids)
          .eq("tenant_id", sourceTenantId);

        if (originals?.length) {
          const copies = originals.map((c: any, i: number) => ({
            contact_id: `COPY-${Date.now()}-${i}`,
            name: c.name,
            email: c.email,
            phone: c.phone,
            notes: c.notes,
            tenant_id: targetTenantId,
            origin_type: "copied",
            source_contact_id: selected_contact_ids[i],
            source_user_id: user.id,
          }));
          const { data: inserted } = await svc.from("contacts").insert(copies).select("id");
          copiedContacts = inserted?.length || 0;
        }
      }
    }
    // "private" strategy — nothing to do, relationships stay in personal space

    // Mark invite as accepted
    await svc.from("tenant_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite_id);

    // Mark absorption as completed
    await svc.from("companion_absorption_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", absorptionReq.id);

    // Fetch tenant name for response
    const { data: tenant } = await svc
      .from("tenants")
      .select("name")
      .eq("id", targetTenantId)
      .single();

    return json(200, {
      ok: true,
      message: `You've joined ${tenant?.name || "the organization"}. The thread is still here.`,
      tenant_id: targetTenantId,
      tenant_name: tenant?.name,
      strategy: relationship_strategy,
      moved_opportunities: movedOpps,
      copied_opportunities: copiedOpps,
      moved_contacts: movedContacts,
      copied_contacts: copiedContacts,
    });
  } catch (e) {
    console.error("Companion absorption error:", e);
    return json(500, { ok: false, error: e instanceof Error ? e.message : "Unknown error" });
  }
});

function json(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
