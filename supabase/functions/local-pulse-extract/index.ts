import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// Service-only auth
function authenticateService(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  if (!token) return false;

  if (enrichmentSecret && token === enrichmentSecret) return true;
  if (sharedSecret && token === sharedSecret) return true;
  return false;
}

const BATCH_SIZE = 25;

// Validate date is within acceptable range (30 days back, 1 year forward)
function isDateInRange(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = Date.now();
    if (d.getTime() < now - 30 * 86400000) return false;
    if (d.getTime() > now + 365 * 86400000) return false;
    return true;
  } catch {
    return false;
  }
}

function parseAndValidateDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const iso = d.toISOString().slice(0, 10);
    return isDateInRange(iso) ? iso : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST");

  if (!authenticateService(req)) {
    return jsonError(401, "UNAUTHORIZED", "Service-only endpoint");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!apiKey) return jsonError(500, "CONFIG_ERROR", "LOVABLE_API_KEY not set");

  try {
    const body = await req.json().catch(() => ({}));
    const metroId = body.metro_id as string | undefined;

    // Fetch pending events (batch limited)
    let query = supabase
      .from("events")
      .select("id, event_name, description, url, city, metro_id, is_recurring, event_date")
      .eq("extraction_status", "pending")
      .eq("is_local_pulse", true)
      .limit(BATCH_SIZE);

    if (metroId) {
      query = query.eq("metro_id", metroId);
    }

    const { data: pendingEvents, error: fetchErr } = await query;
    if (fetchErr) return jsonError(500, "DB_ERROR", fetchErr.message);
    if (!pendingEvents || pendingEvents.length === 0) {
      return jsonOk({ ok: true, processed: 0, message: "No pending events" });
    }

    // Get metro names for context
    const metroIds = [...new Set(pendingEvents.map(e => e.metro_id).filter(Boolean))];
    const { data: metros } = await supabase
      .from("metros")
      .select("id, metro")
      .in("id", metroIds);
    const metroNameMap = new Map((metros ?? []).map(m => [m.id, m.metro]));

    let completed = 0;
    let failed = 0;

    for (const event of pendingEvents) {
      try {
        const metroName = metroNameMap.get(event.metro_id) ?? "unknown area";
        const content = [event.event_name, event.description, event.city].filter(Boolean).join(" | ");
        const isHtmlPage = (content.length > 500); // HTML sources have large description blobs

        if (content.length < 10) {
          await supabase.from("events").update({
            extraction_status: "complete",
          }).eq("id", event.id);
          completed++;
          continue;
        }

        const currentDate = new Date().toISOString().slice(0, 10);
        const currentYear = new Date().getFullYear();
        const systemPrompt = isHtmlPage
          ? `You are extracting structured event data from a web page's content. The page may contain MULTIPLE events.
Today's date is ${currentDate}. The current year is ${currentYear}. When dates don't include a year, assume ${currentYear} (or ${currentYear + 1} if the month has already passed this year).
Return ONLY a JSON array of event objects. Each object has these keys:
{
  "title": "event title (max 200 chars)",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "location": "city/venue or null",
  "host_organization": "org name or null",
  "description": "clean 1-sentence summary (max 200 chars) or null",
  "is_recurring": boolean
}
Only include events near ${metroName}. Only include events with dates from the last 30 days through 1 year ahead. If you find no events, return an empty array [].`
          : `You are extracting structured event data from a raw event record.
Today's date is ${currentDate}. The current year is ${currentYear}. When dates don't include a year, assume ${currentYear}.
Return ONLY a JSON object with these keys:
{
  "title": "cleaned event title (max 200 chars)",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "location": "city/venue or null",
  "host_organization": "org name or null",
  "description": "clean 1-sentence summary (max 200 chars) or null",
  "is_recurring": boolean
}
Prefer events near ${metroName}. If no clear date, set start_date to null. Mark is_recurring=true if the event repeats.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: content.slice(0, 30000) },
            ],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok) {
          await supabase.from("events").update({ extraction_status: "failed" }).eq("id", event.id);
          failed++;
          continue;
        }

        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content ?? "";

        if (isHtmlPage) {
          // Parse array of events from HTML page
          const arrMatch = text.match(/\[[\s\S]*\]/);
          if (!arrMatch) {
            await supabase.from("events").update({ extraction_status: "failed" }).eq("id", event.id);
            failed++;
            continue;
          }

          let parsedEvents: any[];
          try {
            parsedEvents = JSON.parse(arrMatch[0]);
          } catch {
            await supabase.from("events").update({ extraction_status: "failed" }).eq("id", event.id);
            failed++;
            continue;
          }

          if (!Array.isArray(parsedEvents) || parsedEvents.length === 0) {
            // AI found no events on this page
            await supabase.from("events").update({
              extraction_status: "complete",
              description: "No events found on this page",
            }).eq("id", event.id);
            completed++;
            continue;
          }

          // Filter to only events with valid in-range dates, then process
          const validEvents = parsedEvents.filter((pe: any) => {
            const d = parseAndValidateDate(pe.start_date);
            return d !== null; // only keep events with valid future-ish dates
          });

          console.log(`HTML extraction: ${parsedEvents.length} total events, ${validEvents.length} with valid dates`);

          if (validEvents.length === 0) {
            await supabase.from("events").update({
              extraction_status: "complete",
              description: `AI found ${parsedEvents.length} events but none had dates in the valid range (last 30 days to 1 year ahead).`,
            }).eq("id", event.id);
            completed++;
            continue;
          }

          // Update the original placeholder event with the first valid result
          const first = validEvents[0];
          const firstUpdate: Record<string, unknown> = { extraction_status: "complete" };
          if (first.title) firstUpdate.event_name = String(first.title).slice(0, 255);
          const firstDate = parseAndValidateDate(first.start_date);
          if (firstDate) {
            firstUpdate.event_date = firstDate;
            firstUpdate.date_confidence = "high";
            firstUpdate.needs_review = false;
          }
          const firstEndDate = parseAndValidateDate(first.end_date);
          if (firstEndDate) firstUpdate.end_date = firstEndDate;
          if (first.location) firstUpdate.city = String(first.location).slice(0, 255);
          if (first.host_organization) firstUpdate.host_organization = String(first.host_organization).slice(0, 255);
          if (first.description) firstUpdate.description = String(first.description).slice(0, 500);
          if (typeof first.is_recurring === "boolean") firstUpdate.is_recurring = first.is_recurring;

          await supabase.from("events").update(firstUpdate).eq("id", event.id);
          completed++;

          // Insert remaining valid events as new rows
          if (validEvents.length > 1) {
            const newRows = validEvents.slice(1, 30).map((pe: any) => {
              const eventDate = parseAndValidateDate(pe.start_date);
              const endDate = parseAndValidateDate(pe.end_date);
              return {
                event_id: `lp-${crypto.randomUUID().slice(0, 8)}`,
                event_name: String(pe.title || "Untitled").slice(0, 255),
                event_date: eventDate,
                end_date: endDate,
                metro_id: event.metro_id,
                city: pe.location ? String(pe.location).slice(0, 255) : null,
                host_organization: pe.host_organization ? String(pe.host_organization).slice(0, 255) : null,
                url: event.url,
                description: pe.description ? String(pe.description).slice(0, 500) : null,
                is_local_pulse: true,
                is_recurring: typeof pe.is_recurring === "boolean" ? pe.is_recurring : false,
                extraction_status: "complete",
                date_confidence: eventDate ? "high" : "low",
                needs_review: !eventDate,
                metadata: { source: "local_pulse", discovery_type: "html_extract" },
              };
            }).filter((r: any) => r.event_name && r.event_name !== "Untitled");

            if (newRows.length > 0) {
              const { error: insertErr } = await supabase.from("events").insert(newRows);
              if (insertErr) console.error("Multi-event insert error:", insertErr);
              else completed += newRows.length;
            }
          }

        } else {
          // Single-event extraction (RSS items etc.)
          const match = text.match(/\{[\s\S]*\}/);
          if (!match) {
            await supabase.from("events").update({ extraction_status: "failed" }).eq("id", event.id);
            failed++;
            continue;
          }

          const parsed = JSON.parse(match[0]);
          const updateFields: Record<string, unknown> = { extraction_status: "complete" };

          if (parsed.title && typeof parsed.title === "string") updateFields.event_name = parsed.title.slice(0, 255);
          const singleDate = parseAndValidateDate(parsed.start_date);
          if (singleDate) {
            updateFields.event_date = singleDate;
            updateFields.date_confidence = "high";
            updateFields.needs_review = false;
          }
          const singleEndDate = parseAndValidateDate(parsed.end_date);
          if (singleEndDate) updateFields.end_date = singleEndDate;
          if (parsed.location) updateFields.city = String(parsed.location).slice(0, 255);
          if (parsed.host_organization) updateFields.host_organization = String(parsed.host_organization).slice(0, 255);
          if (parsed.description) updateFields.description = String(parsed.description).slice(0, 500);
          if (typeof parsed.is_recurring === "boolean") updateFields.is_recurring = parsed.is_recurring;

          await supabase.from("events").update(updateFields).eq("id", event.id);
          completed++;
        }
      } catch (e) {
        console.error(`Extraction failed for event ${event.id}:`, e);
        await supabase.from("events").update({ extraction_status: "failed" }).eq("id", event.id);
        failed++;
      }
    }

    return jsonOk({
      ok: true,
      processed: pendingEvents.length,
      completed,
      failed,
    });
  } catch (e) {
    console.error("local-pulse-extract error:", e);
    return jsonError(500, "INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
  }
});
