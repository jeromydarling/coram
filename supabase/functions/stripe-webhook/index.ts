import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[stripe-webhook] ${step}${d}`);
};

/** Feature flags by tier */
const TIER_FLAGS: Record<string, Record<string, boolean>> = {
  core: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: false, impulsus: false, relatio: false,
  },
  insight: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: false, relatio: false,
  },
  story: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: true, relatio: false,
  },
  bridge: {
    civitas: true, voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: true, relatio: true,
  },
};

/** Map price_id → base tier key — LIVE account: CROS LLC */
const BASE_PRICE_MAP: Record<string, string> = {
  "price_1TAh8YIuo9wd3dMdDsWk0zXv": "core",
  "price_1TAh8ZIuo9wd3dMdXAIoOK9R": "insight",
  "price_1TAh8bIuo9wd3dMd4YKAeOoK": "story",
  "price_1TAh8cIuo9wd3dMdLjH7qASI": "bridge",
};

/** Map price_id → addon key */
const ADDON_PRICE_MAP: Record<string, string> = {
  "price_1TAh8dIuo9wd3dMdIFYzeUI6": "additional_users",
  "price_1TAh8fIuo9wd3dMd6jHf5xR4": "capacity_expansion_25",
  "price_1TAh8gIuo9wd3dMdXqcnBkuz": "capacity_expansion_75",
  "price_1TAh8iIuo9wd3dMd6hCL1yrn": "capacity_expansion_200",
  "price_1TAh8jIuo9wd3dMdm1801HLv": "campaigns",
  "price_1TAh8kIuo9wd3dMdJs8QxN9A": "expansion_capacity",
};

/** Guided Activation price map */
const GUIDED_ACTIVATION_MAP: Record<string, { key: string; sessions: number }> = {
  "price_1TAh8mIuo9wd3dMdTPBCfjiw": { key: "guided_activation", sessions: 1 },
  "price_1TAh8oIuo9wd3dMdxaqqP4pi": { key: "guided_activation_plus", sessions: 2 },
};

/** Included users per base tier */
const TIER_INCLUDED_USERS: Record<string, number> = {
  core: 3, insight: 3, story: 5, bridge: 10,
};

interface EntitlementState {
  plan_key: string;
  included_users: number;
  addon_users: number;
  ai_tier: string;
  local_pulse_tier: string;
  nri_tier: string;
  campaigns_enabled: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

/** Parse subscription items into entitlement state */
function parseSubscriptionItems(items: Stripe.SubscriptionItem[]): Partial<EntitlementState> {
  let planKey = "core";
  let addonUsers = 0;
  let campaignsEnabled = false;

  for (const item of items) {
    const priceId = item.price.id;
    const baseTier = BASE_PRICE_MAP[priceId];
    if (baseTier) {
      planKey = baseTier;
      continue;
    }
    const addon = ADDON_PRICE_MAP[priceId];
    if (addon === "additional_users") {
      addonUsers = item.quantity ?? 0;
    } else if (addon === "campaigns") {
      campaignsEnabled = true;
    }
  }

  return {
    plan_key: planKey,
    included_users: TIER_INCLUDED_USERS[planKey] ?? 3,
    addon_users: addonUsers,
    ai_tier: "base",
    local_pulse_tier: "base",
    nri_tier: "standard",
    campaigns_enabled: campaignsEnabled,
  };
}

async function logHealthEvent(
  svc: ReturnType<typeof createClient>,
  key: string,
  status: string,
  stats: Record<string, unknown>,
  error?: Record<string, unknown> | null,
  tenantId?: string | null,
) {
  try {
    await svc.from("operator_schedules").upsert(
      { key, cadence: "manual", enabled: true, last_run_at: new Date().toISOString(), last_status: status, last_stats: stats, last_error: error ?? null },
      { onConflict: "key" },
    );
    await svc.from("system_health_events").insert({
      schedule_key: key, tenant_id: tenantId ?? null, status, stats, error: error ?? null,
    });
  } catch (e) {
    console.error("[stripe-webhook] health event write failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: "stripe_not_configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceRoleKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ ok: false, error: "missing_signature" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  try {
    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      logStep("Signature verification failed", { error: String(err) });
      return new Response(JSON.stringify({ ok: false, error: "invalid_signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const type = event.type;
    logStep("Event received", { type, id: event.id });

    // ── Idempotency check ─────────────────────────────────────
    const { data: existingEvent } = await svc
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      logStep("Duplicate event, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record event for idempotency
    await svc.from("stripe_webhook_events").insert({ event_id: event.id });

    // ── checkout.session.completed ──────────────────────────
    if (type === "checkout.session.completed") try {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_details?.email ?? session.customer_email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const tiers = session.metadata?.tiers ?? "core";
      const primaryTier = tiers.split(",").pop() ?? "core";

      logStep("Checkout completed", { customerEmail, customerId, subscriptionId, tiers });

      // Parse add-ons from the subscription if available
      let entitlements: Partial<EntitlementState> = { plan_key: primaryTier, included_users: TIER_INCLUDED_USERS[primaryTier] ?? 3 };

      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          entitlements = parseSubscriptionItems(sub.items.data);
          const cps = sub.current_period_start ?? (sub.items.data[0] as unknown as { current_period_start?: number })?.current_period_start;
          const cpe = sub.current_period_end ?? (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end;
          entitlements.current_period_start = cps ? new Date(cps * 1000).toISOString() : null;
          entitlements.current_period_end = cpe ? new Date(cpe * 1000).toISOString() : null;
        } catch (e) {
          logStep("Failed to retrieve subscription details", { error: String(e) });
        }
      }

      if (customerEmail) {
        const { data: users } = await svc.auth.admin.listUsers();
        const user = users?.users?.find((u) => u.email === customerEmail);

        if (user) {
          const { data: existingMembership } = await svc
            .from("tenant_users")
            .select("tenant_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (existingMembership?.tenant_id) {
            const tenantId = existingMembership.tenant_id;

            // Snapshot before state
            const { data: beforeRow } = await svc
              .from("tenant_entitlements")
              .select("*")
              .eq("tenant_id", tenantId)
              .maybeSingle();

            // Update tenant_subscriptions (legacy)
            await svc.from("tenant_subscriptions").upsert(
              { tenant_id: tenantId, stripe_customer_id: customerId, stripe_subscription_id: subscriptionId, status: "active" },
              { onConflict: "tenant_id" },
            );

            // Upsert tenant_entitlements
            await svc.from("tenant_entitlements").upsert({
              tenant_id: tenantId,
              plan_key: entitlements.plan_key ?? primaryTier,
              included_users: entitlements.included_users ?? 3,
              addon_users: entitlements.addon_users ?? 0,
              ai_tier: entitlements.ai_tier ?? "base",
              local_pulse_tier: entitlements.local_pulse_tier ?? "base",
              nri_tier: entitlements.nri_tier ?? "standard",
              campaigns_enabled: entitlements.campaigns_enabled ?? false,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_status: "active",
              current_period_start: entitlements.current_period_start ?? null,
              current_period_end: entitlements.current_period_end ?? null,
              last_synced_at: new Date().toISOString(),
              is_stale: false,
            }, { onConflict: "tenant_id" });

            // Audit log
            await svc.from("tenant_entitlement_audit").insert({
              tenant_id: tenantId,
              actor: "stripe_webhook",
              event_type: type,
              before: beforeRow ?? {},
              after: entitlements,
              stripe_event_id: event.id,
            });

            // Update tier + flags
            const finalTier = entitlements.plan_key ?? primaryTier;
            await svc.from("tenants").update({ tier: finalTier }).eq("id", tenantId);
            const flags = TIER_FLAGS[finalTier] ?? TIER_FLAGS.core;
            for (const [key, enabled] of Object.entries(flags)) {
              await svc.from("tenant_feature_flags").upsert(
                { tenant_id: tenantId, key, enabled },
                { onConflict: "tenant_id,key" },
              );
            }

            logStep("Updated existing tenant", { tenantId, tier: finalTier });
            await logHealthEvent(svc, "tenant_provision", "ok", {
              action: "upgrade", tenant_id: tenantId, tier: finalTier,
            }, null, tenantId);

            // Provision Guided Activation if purchased
            const gaKey = session.metadata?.guided_activation;
            const gaSessions = parseInt(session.metadata?.guided_activation_sessions ?? "0", 10);
            if (gaKey && gaSessions > 0) {
              await svc.from("activation_sessions").upsert({
                tenant_id: tenantId,
                purchased_by: user.id,
                session_type: gaKey,
                sessions_total: gaSessions,
                sessions_remaining: gaSessions,
                status: "pending",
                stripe_checkout_session_id: session.id,
                stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              }, { onConflict: "stripe_checkout_session_id" });
              logStep("Provisioned Guided Activation", { tenantId, type: gaKey, sessions: gaSessions });
            }

            // ── Founding Garden grant (atomic, race-safe) ──
            const fgRequested = session.metadata?.founding_garden_requested === "true";
            const fgProgramKey = session.metadata?.founding_garden_program_key;
            if (fgRequested && fgProgramKey) {
              const { data: grantResult, error: grantErr } = await svc.rpc(
                "grant_founding_garden_if_available",
                {
                  p_tenant_id: tenantId,
                  p_program_key: fgProgramKey,
                  p_stripe_session_id: session.id,
                  p_stripe_subscription_id: subscriptionId ?? null,
                },
              );
              if (grantErr) {
                logStep("Founding Garden grant RPC error", { error: String(grantErr) });
              } else {
                logStep("Founding Garden grant result", grantResult);
              }
            }
          } else {
            // No tenant yet — store pending info in user metadata
            await svc.auth.admin.updateUserById(user.id, {
              user_metadata: {
                ...user.user_metadata,
                pending_stripe_customer_id: customerId,
                pending_stripe_subscription_id: subscriptionId,
                pending_tiers: tiers,
                pending_primary_tier: primaryTier,
                pending_addons: {
                  addon_users: entitlements.addon_users ?? 0,
                  ai_tier: entitlements.ai_tier ?? "base",
                  local_pulse_tier: entitlements.local_pulse_tier ?? "base",
                  nri_tier: entitlements.nri_tier ?? "standard",
                },
              },
            });
            logStep("Stored pending subscription", { userId: user.id, tier: primaryTier });
            await logHealthEvent(svc, "tenant_provision", "ok", {
              action: "pending_metadata", user_id: user.id, tier: primaryTier,
            });
          }
        } else {
          logStep("No matching user for email", { customerEmail });
          await logHealthEvent(svc, "tenant_provision", "warning", {
            action: "no_user_match", email: customerEmail,
          });
        }
      }
    } catch (e) {
      logStep("checkout.session.completed handler error", { error: e instanceof Error ? e.message : String(e), eventId: event.id });
    }

    // ── subscription created/updated/deleted ────────────────
    if (type === "customer.subscription.created" || type === "customer.subscription.updated" || type === "customer.subscription.deleted") try {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;

      const { data: existing } = await svc
        .from("tenant_subscriptions")
        .select("tenant_id")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();

      // Also try via entitlements table
      let tenantId = existing?.tenant_id;
      if (!tenantId) {
        const { data: entRow } = await svc
          .from("tenant_entitlements")
          .select("tenant_id")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();
        tenantId = entRow?.tenant_id;
      }

      if (tenantId) {
        const entitlements = parseSubscriptionItems(sub.items.data);
        const stripeStatus = sub.status === "active" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" ? "cancelled"
          : sub.status;

        // Snapshot before
        const { data: beforeRow } = await svc
          .from("tenant_entitlements")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        // Stripe API 2025-08-27 moved period fields from subscription to items
        const cps = sub.current_period_start ?? (sub.items.data[0] as unknown as { current_period_start?: number })?.current_period_start;
        const cpe = sub.current_period_end ?? (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end;
        const cpeIso = cpe ? new Date(cpe * 1000).toISOString() : null;
        const cpsIso = cps ? new Date(cps * 1000).toISOString() : null;

        // Update legacy tenant_subscriptions
        await svc.from("tenant_subscriptions").update({
          status: stripeStatus,
          current_period_end: cpeIso,
        }).eq("tenant_id", tenantId);

        // Upsert entitlements
        await svc.from("tenant_entitlements").upsert({
          tenant_id: tenantId,
          plan_key: entitlements.plan_key ?? "core",
          included_users: entitlements.included_users ?? 3,
          addon_users: entitlements.addon_users ?? 0,
          ai_tier: entitlements.ai_tier ?? "base",
          local_pulse_tier: entitlements.local_pulse_tier ?? "base",
          nri_tier: entitlements.nri_tier ?? "standard",
          campaigns_enabled: entitlements.campaigns_enabled ?? false,
          stripe_status: stripeStatus,
          current_period_start: cpsIso,
          current_period_end: cpeIso,
          last_synced_at: new Date().toISOString(),
          is_stale: false,
        }, { onConflict: "tenant_id" });


        // Audit
        await svc.from("tenant_entitlement_audit").insert({
          tenant_id: tenantId,
          actor: "stripe_webhook",
          event_type: type,
          before: beforeRow ?? {},
          after: { ...entitlements, stripe_status: stripeStatus },
          stripe_event_id: event.id,
        });

        // Sync tenant status + tier
        const tenantStatus = stripeStatus === "cancelled" ? "canceled" : stripeStatus === "active" ? "active" : "past_due";
        await svc.from("tenants").update({ status: tenantStatus, tier: entitlements.plan_key }).eq("id", tenantId);

        // Update feature flags
        const flags = TIER_FLAGS[entitlements.plan_key ?? "core"] ?? TIER_FLAGS.core;
        for (const [key, enabled] of Object.entries(flags)) {
          await svc.from("tenant_feature_flags").upsert(
            { tenant_id: tenantId, key, enabled },
            { onConflict: "tenant_id,key" },
          );
        }

        logStep("Subscription synced", { tenantId, status: stripeStatus, ...entitlements });
      }
    } catch (e) {
      logStep("customer.subscription.* handler error", { error: e instanceof Error ? e.message : String(e), eventId: event.id });
    }

    // ── invoice.payment_succeeded ───────────────────────────
    if (type === "invoice.payment_succeeded") try {
      const invoice = event.data.object as Stripe.Invoice;
      // Stripe API 2025-08-27 removed invoice.subscription at the top level;
      // fall back to invoice.parent.subscription_details.subscription or line items.
      const subId = ((invoice as unknown as { subscription?: string }).subscription)
        ?? (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription
        ?? (invoice.lines?.data?.find((l) => (l as unknown as { subscription?: string }).subscription) as unknown as { subscription?: string } | undefined)?.subscription
        ?? null;
      if (subId) {
        const { data: existing } = await svc
          .from("tenant_subscriptions")
          .select("tenant_id")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();

        if (existing?.tenant_id) {
          await svc.from("tenant_subscriptions").update({ status: "active" }).eq("tenant_id", existing.tenant_id);
          await svc.from("tenants").update({ status: "active" }).eq("id", existing.tenant_id);
          await svc.from("tenant_entitlements").update({ stripe_status: "active", is_stale: false, last_synced_at: new Date().toISOString() }).eq("tenant_id", existing.tenant_id);
          logStep("Payment succeeded, marked active", { tenantId: existing.tenant_id });
        }
      }
    } catch (e) {
      logStep("invoice.payment_succeeded handler error", { error: e instanceof Error ? e.message : String(e), eventId: event.id });
    }

    // ── invoice.payment_failed ──────────────────────────────
    if (type === "invoice.payment_failed") try {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = ((invoice as unknown as { subscription?: string }).subscription)
        ?? (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription
        ?? (invoice.lines?.data?.find((l) => (l as unknown as { subscription?: string }).subscription) as unknown as { subscription?: string } | undefined)?.subscription
        ?? null;
      if (subId) {
        await svc.from("tenant_subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", subId);
        await svc.from("tenant_entitlements").update({ stripe_status: "past_due", last_synced_at: new Date().toISOString() }).eq("stripe_subscription_id", subId);
        logStep("Payment failed, marked past_due", { subId });
      }
    } catch (e) {
      logStep("invoice.payment_failed handler error", { error: e instanceof Error ? e.message : String(e), eventId: event.id });
    }

    return new Response(JSON.stringify({ ok: true, received: type }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("stripe-webhook error:", msg);
    await logHealthEvent(svc, "tenant_provision", "error", {}, { message: msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
