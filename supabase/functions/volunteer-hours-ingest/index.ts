import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

/** Round minutes to nearest 5 */
function roundTo5(mins: number): number {
  return Math.round(mins / 5) * 5 || 5; // minimum 5
}

/** Parse HOURS lines from raw email text.
 *  Format: HOURS: YYYY-MM-DD | <hours> | warehouse|event: <name>
 */
function parseHoursLines(rawText: string): Array<{
  date: string;
  minutes: number;
  kind: "warehouse" | "event";
  eventName: string | null;
  raw: string;
}> {
  const results: Array<{
    date: string;
    minutes: number;
    kind: "warehouse" | "event";
    eventName: string | null;
    raw: string;
  }> = [];

  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.toUpperCase().startsWith("HOURS:")) continue;

    const afterPrefix = trimmed.slice(6).trim(); // remove "HOURS:"
    const parts = afterPrefix.split("|").map((p) => p.trim());
    if (parts.length < 3) continue;

    const [dateStr, hoursStr, locationStr] = parts;

    // Validate date YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    const dateObj = new Date(dateStr + "T00:00:00Z");
    if (isNaN(dateObj.getTime())) continue;

    // Validate hours (integer or decimal, positive)
    const hoursNum = parseFloat(hoursStr);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) continue;

    const minutes = roundTo5(Math.round(hoursNum * 60));

    // Parse location
    const locLower = locationStr.toLowerCase();
    let kind: "warehouse" | "event" = "warehouse";
    let eventName: string | null = null;

    if (locLower === "warehouse") {
      kind = "warehouse";
    } else if (locLower.startsWith("event:")) {
      kind = "event";
      eventName = locationStr.slice(6).trim() || null;
    } else {
      // Default to warehouse for unrecognized
      kind = "warehouse";
    }

    results.push({ date: dateStr, minutes, kind, eventName, raw: trimmed });
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: service-only ──
    const authHeader = req.headers.get("authorization") ?? "";
    const apiKey = req.headers.get("x-api-key") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const sharedSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";
    const enrichSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") ?? "";

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;
    const isSharedSecret =
      (sharedSecret && (apiKey === sharedSecret || token === sharedSecret)) ||
      (enrichSecret && apiKey === enrichSecret);

    if (!isServiceRole && !isSharedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const body = await req.json();
    const {
      gmail_message_id,
      from_email,
      received_at,
      subject,
      snippet,
      raw_text,
    } = body;

    if (!gmail_message_id || !from_email || !raw_text) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Step 1: DEDUPE ──
    const { data: existingInbox } = await supabase
      .from("volunteer_hours_inbox")
      .select("id")
      .eq("gmail_message_id", gmail_message_id)
      .maybeSingle();

    if (existingInbox) {
      return new Response(
        JSON.stringify({ ok: true, status: "duplicate", inbox_id: existingInbox.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2: Lookup volunteer ──
    const { data: volunteer } = await supabase
      .from("volunteers")
      .select("id, first_name, last_name")
      .eq("email", from_email.toLowerCase().trim())
      .eq("status", "active")
      .maybeSingle();

    if (!volunteer) {
      await supabase.from("volunteer_hours_inbox").insert({
        gmail_message_id,
        from_email: from_email.toLowerCase().trim(),
        received_at: received_at || new Date().toISOString(),
        subject: subject?.slice(0, 500) || null,
        snippet: snippet?.slice(0, 500) || null,
        raw_text: raw_text.slice(0, 5000),
        parse_status: "needs_review",
        reason: "Unknown volunteer email",
        parsed_json: {},
      });

      return new Response(
        JSON.stringify({ ok: true, status: "needs_review", reason: "unknown_email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: Parse HOURS lines ──
    const parsed = parseHoursLines(raw_text);

    if (parsed.length === 0) {
      await supabase.from("volunteer_hours_inbox").insert({
        gmail_message_id,
        from_email: from_email.toLowerCase().trim(),
        received_at: received_at || new Date().toISOString(),
        subject: subject?.slice(0, 500) || null,
        snippet: snippet?.slice(0, 500) || null,
        raw_text: raw_text.slice(0, 5000),
        parse_status: "needs_review",
        reason: "No HOURS line found",
        parsed_json: {},
      });

      return new Response(
        JSON.stringify({ ok: true, status: "needs_review", reason: "no_hours_line" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 4: Process each parsed line ──
    const shifts: Array<Record<string, unknown>> = [];
    const warnings: string[] = [];

    for (const entry of parsed) {
      let eventId: string | null = null;

      if (entry.kind === "event" && entry.eventName) {
        // Try to match event by name (case-insensitive partial match)
        const { data: matchedEvents } = await supabase
          .from("events")
          .select("id, event_name")
          .ilike("event_name", `%${entry.eventName}%`)
          .limit(5);

        if (matchedEvents && matchedEvents.length > 1) {
          // Ambiguity: multiple matches — do NOT auto-select
          warnings.push(
            `Ambiguous event match for "${entry.eventName}" on ${entry.date}: ${matchedEvents.length} matches (${matchedEvents.map(e => e.event_name).join(', ')})`
          );
        } else if (matchedEvents && matchedEvents.length === 1) {
          eventId = matchedEvents[0].id;
        } else {
          warnings.push(
            `Event "${entry.eventName}" not found for ${entry.date}`
          );
        }
      }

      // Check dedupe for this specific email+shift combo
      const { data: existingShift } = await supabase
        .from("volunteer_shifts")
        .select("id")
        .eq("source_email_message_id", gmail_message_id)
        .maybeSingle();

      if (!existingShift) {
        const shiftRecord = {
          volunteer_id: volunteer.id,
          kind: entry.kind,
          event_id: eventId,
          shift_date: entry.date,
          minutes: entry.minutes,
          source: "email" as const,
          source_email_message_id: gmail_message_id,
          raw_text: entry.raw.slice(0, 1000),
        };

        const { error: shiftError } = await supabase
          .from("volunteer_shifts")
          .insert(shiftRecord);

        if (shiftError) {
          // Likely dedupe violation — ignore gracefully
          if (!shiftError.message.includes("duplicate")) {
            warnings.push(`Shift insert error: ${shiftError.message}`);
          }
        } else {
          shifts.push(shiftRecord);
        }
      }
    }

    // ── Step 5: Create inbox record ──
    const parsedJson = {
      volunteer_id: volunteer.id,
      volunteer_name: `${volunteer.first_name} ${volunteer.last_name}`,
      lines_parsed: parsed.length,
      shifts_created: shifts.length,
      warnings,
      entries: parsed.map((e) => ({
        date: e.date,
        minutes: e.minutes,
        kind: e.kind,
        event_name: e.eventName,
        event_id_resolved: shifts.find(s => (s as any).shift_date === e.date)?.event_id ?? null,
      })),
    };

    await supabase.from("volunteer_hours_inbox").insert({
      gmail_message_id,
      from_email: from_email.toLowerCase().trim(),
      received_at: received_at || new Date().toISOString(),
      subject: subject?.slice(0, 500) || null,
      snippet: snippet?.slice(0, 500) || null,
      raw_text: parsed.map((p) => p.raw).join("\n").slice(0, 5000),
      parse_status: warnings.length > 0 ? "needs_review" : "parsed",
      reason: warnings.length > 0 ? warnings.join("; ") : null,
      parsed_json: parsedJson,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        status: warnings.length > 0 ? "partial" : "parsed",
        shifts_created: shifts.length,
        warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("volunteer-hours-ingest error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
