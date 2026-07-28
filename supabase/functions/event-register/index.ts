import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiter (per-instance, resets on cold start)
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 registrations per IP per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limit by IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { event_id, guest_name, guest_email, guest_phone, answers } = body;

    // Validate required fields
    if (!event_id || typeof event_id !== "string") {
      return new Response(JSON.stringify({ error: "event_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!guest_name || typeof guest_name !== "string" || guest_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!guest_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_email)) {
      return new Response(JSON.stringify({ error: "A valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (guest_name.length > 100) {
      return new Response(JSON.stringify({ error: "Name must be less than 100 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Validate event exists and get tenant_id
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, tenant_id, event_name, slug")
      .eq("id", event_id)
      .is("deleted_at", null)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenant_id = event.tenant_id;

    // 2. Upsert contact by email within tenant
    let contact_id: string | null = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("email", guest_email.trim().toLowerCase())
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (existingContact) {
      contact_id = existingContact.id;
    } else {
      const contactId = `C-${Date.now()}`;
      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          contact_id: contactId,
          tenant_id,
          name: guest_name.trim(),
          email: guest_email.trim().toLowerCase(),
          phone: guest_phone?.trim() || null,
          notes: `Registered via public event: ${event.event_name}`,
        })
        .select("id")
        .single();

      if (!contactErr && newContact) {
        contact_id = newContact.id;
      }
    }

    // 3. Check for duplicate registration
    const { data: existingReg } = await supabase
      .from("event_registrations")
      .select("id")
      .eq("event_id", event_id)
      .eq("guest_email", guest_email.trim().toLowerCase())
      .limit(1)
      .single();

    if (existingReg) {
      return new Response(
        JSON.stringify({ success: true, message: "You're already registered for this event.", duplicate: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create registration
    const { error: regErr } = await supabase
      .from("event_registrations")
      .insert({
        tenant_id,
        event_id,
        contact_id,
        guest_name: guest_name.trim(),
        guest_email: guest_email.trim().toLowerCase(),
        guest_phone: guest_phone?.trim() || null,
        answers: answers || {},
      });

    if (regErr) {
      console.error("Registration insert error:", regErr);
      return new Response(JSON.stringify({ error: "Failed to register" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Create activity record
    if (contact_id) {
      const activityId = `ACT-REG-${Date.now()}`;
      await supabase.from("activities").insert({
        activity_id: activityId,
        tenant_id,
        contact_id,
        opportunity_id: null,
        activity_type: "Event",
        activity_date_time: new Date().toISOString(),
        notes: `Public registration for "${event.event_name}"`,
        attended: false,
      });
    }

    // 6. Testimonium capture (silent)
    try {
      await supabase.from("testimonium_events").insert({
        tenant_id,
        source_module: "event",
        event_kind: "public_registration",
        summary: `${guest_name.trim()} registered for ${event.event_name}`.slice(0, 240),
        signal_weight: 2,
        metadata: { event_id, contact_id, source: "public_registration" },
        occurred_at: new Date().toISOString(),
      });
    } catch (_) {
      // Silent — testimonium never blocks
    }

    // 7. Notify tenant stewards (bundled: max 1 notification per event per hour)
    try {
      const { data: tenantUsers } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .limit(10);

      if (tenantUsers && tenantUsers.length > 0) {
        const hourBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const dedupeKey = `event_reg:${event_id}:${hourBucket}`;

        // Check if a notification with this dedupe_key already exists this hour
        const { count: existingNotifCount } = await supabase
          .from("proactive_notifications")
          .select("id", { count: "exact", head: true })
          .eq("notification_type", "event_registration")
          .contains("payload", { dedupe_key: dedupeKey } as any);

        if ((existingNotifCount ?? 0) === 0) {
          // Count total registrations for this event today for richer context
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const { count: todayRegCount } = await supabase
            .from("event_registrations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event_id)
            .gte("created_at", todayStart.toISOString());

          const notifications = tenantUsers.map((tu: any) => ({
            user_id: tu.user_id,
            notification_type: "event_registration",
            payload: {
              dedupe_key: dedupeKey,
              title: `New registration for ${event.event_name}`,
              why: (todayRegCount ?? 1) > 1
                ? `${todayRegCount} people have registered today — your community is growing.`
                : `${guest_name.trim()} has registered — your community is growing.`,
              event_id,
              event_name: event.event_name,
              guest_name: guest_name.trim(),
              today_count: todayRegCount ?? 1,
            },
          }));

          await supabase.from("proactive_notifications").insert(notifications);
        }
      }
    } catch (_) {
      // Silent — notification never blocks registration
    }

    return new Response(
      JSON.stringify({ success: true, message: "You're registered. We look forward to seeing you." }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Event registration error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
