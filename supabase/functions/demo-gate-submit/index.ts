/**
 * demo-gate-submit — Captures demo access requests as Gardener pipeline leads.
 *
 * WHAT: Creates an operator_opportunity + operator_contact from demo form submission.
 *       Sends an email notification to the Gardener admin.
 * WHERE: Called from /demo public gate page (no auth required).
 * WHY: Every demo visitor becomes a trackable lead in the Gardener's Crescere pipeline.
 *
 * SEC-002: Origin-aware CORS (shared module).
 * SEC-004: Rate limiting via shared rateLimitPublic.
 * SEC-007: Uses shared error envelope + CORS utilities.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightResponse } from "../_shared/cors.ts";
import { guardPublicEndpoint } from "../_shared/rateLimitPublic.ts";
import { withErrorEnvelope, successResponse, errorResponse, ERROR_CODES } from "../_shared/errorEnvelope.ts";

async function notifyGardener(
  svc: ReturnType<typeof createClient>,
  lead: { name: string; email: string; location: string; role_selected?: string; opportunity_id: string },
) {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.warn("[demo-gate-submit] RESEND_API_KEY not set — skipping Gardener notification");
      return;
    }

    // Look up admin user emails via auth.admin API
    const { data: adminRoles } = await svc
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(5);

    if (!adminRoles?.length) {
      console.warn("[demo-gate-submit] No admin users found for notification");
      return;
    }

    const adminEmails: string[] = [];
    for (const role of adminRoles) {
      const { data } = await svc.auth.admin.getUserById(role.user_id);
      if (data?.user?.email) adminEmails.push(data.user.email);
    }

    if (!adminEmails.length) {
      console.warn("[demo-gate-submit] No admin emails resolved");
      return;
    }

    const roleLabel = lead.role_selected || "not specified";
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const html = `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px; color: #1a1a2e;">
          🌱 New Demo Request
        </h2>
        <p style="font-size: 14px; color: #666; margin: 0 0 24px;">
          Someone is exploring CROS™ — ${date}
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #888; width: 100px;">Name</td>
            <td style="padding: 8px 0; font-weight: 500;">${lead.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">Email</td>
            <td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #1a1a2e;">${lead.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">Location</td>
            <td style="padding: 8px 0;">${lead.location}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">Role</td>
            <td style="padding: 8px 0;">${roleLabel}</td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0 16px;" />
        <p style="font-size: 12px; color: #999; margin: 0;">
          This lead has been added to your Crescere pipeline. View it in the Gardener Console.
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CROS Demo <noreply@notify.thedistributists.com>",
        to: adminEmails,
        subject: `🌱 Demo request from ${lead.name}`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[demo-gate-submit] Resend error ${res.status}: ${body}`);
    } else {
      await res.text();
      console.log(`[demo-gate-submit] Gardener notification sent to ${adminEmails.join(", ")}`);
    }
  } catch (err) {
    console.error("[demo-gate-submit] Failed to send Gardener notification:", err);
  }
}

Deno.serve(withErrorEnvelope(async (req) => {
  // Rate limiting (5 per 10 minutes)
  const blocked = guardPublicEndpoint(req, 'demo-gate-submit', {
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
  });
  if (blocked) return blocked;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', ERROR_CODES.VALIDATION_ERROR, 405);
  }

  const { name, email, location, role_selected } = await req.json();

  if (!name || !email || !location) {
    return errorResponse(req, 'Name, email, and location are required', ERROR_CODES.VALIDATION_ERROR);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(req, 'Invalid email address', ERROR_CODES.VALIDATION_ERROR);
  }

  if (name.length > 100 || email.length > 255 || location.length > 200) {
    return errorResponse(req, 'Input too long', ERROR_CODES.VALIDATION_ERROR);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  // Dedupe: check if this email already has a demo lead
  const { data: existing } = await svc
    .from("operator_contacts")
    .select("id, opportunity_id")
    .eq("email", email.toLowerCase().trim())
    .eq("source", "demo_gate")
    .maybeSingle();

  if (existing) {
    return successResponse(req, undefined, { dedupe: true, opportunity_id: existing.opportunity_id });
  }

  // Find the gardener user (admin) to use as created_by
  const { data: adminRole } = await svc
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .single();

  const createdBy = adminRole?.user_id ?? "00000000-0000-0000-0000-000000000000";

  // Create operator_opportunity (the lead/org)
  const orgName = `Demo Lead — ${name}`;
  const { data: opp, error: oppErr } = await svc
    .from("operator_opportunities")
    .insert({
      organization: orgName,
      stage: "prospect",
      status: "active",
      source: "demo_gate",
      city: location,
      description: `Demo access request. Role selected: ${role_selected || "not specified"}. Location: ${location}`,
      notes: `Submitted via /demo gate on ${new Date().toISOString().split("T")[0]}`,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (oppErr) {
    console.error("Failed to create operator_opportunity:", oppErr);
    return errorResponse(req, 'Failed to record demo request', ERROR_CODES.INTERNAL_ERROR, 500);
  }

  // Create operator_contact
  const { error: contactErr } = await svc
    .from("operator_contacts")
    .insert({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      organization: location,
      source: "demo_gate",
      notes: `Demo lead for "${orgName}". Role interest: ${role_selected || "not specified"}. Opp ID: ${opp.id}`,
      created_by: createdBy,
    });

  if (contactErr) {
    console.error("Failed to create operator_contact:", contactErr);
  }

  // Fire-and-forget: notify Gardener admin(s) via email
  notifyGardener(svc, {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    location,
    role_selected,
    opportunity_id: opp.id,
  }).catch(() => { /* swallow — notification is best-effort */ });

  return successResponse(req, undefined, { opportunity_id: opp.id });
}));
