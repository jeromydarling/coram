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

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function authenticateServiceRequest(req: Request): boolean {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return false;
  if (!enrichmentSecret && !sharedSecret) return false;

  return (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CoattendanceInput {
  run_id: string;
  event_item_id: string;
  opportunity_ids: string[];
  attendance_type?: string;
  evidence_url?: string;
  evidence_snippet?: string;
}

export function validateInput(body: unknown): { valid: true; data: CoattendanceInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.run_id !== "string" || !UUID_RE.test(b.run_id)) {
    return { valid: false, error: "run_id: required valid UUID" };
  }
  if (typeof b.event_item_id !== "string" || !UUID_RE.test(b.event_item_id)) {
    return { valid: false, error: "event_item_id: required valid UUID" };
  }
  if (!Array.isArray(b.opportunity_ids) || b.opportunity_ids.length === 0) {
    return { valid: false, error: "opportunity_ids: required non-empty array of UUIDs" };
  }

  for (const id of b.opportunity_ids) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return { valid: false, error: `opportunity_ids: invalid UUID "${id}"` };
    }
  }

  const validTypes = ["attended", "sponsoring", "speaking", "exhibiting"];
  const aType = typeof b.attendance_type === "string" ? b.attendance_type : "attended";
  if (!validTypes.includes(aType)) {
    return { valid: false, error: `attendance_type must be one of: ${validTypes.join(", ")}` };
  }

  return {
    valid: true,
    data: {
      run_id: b.run_id,
      event_item_id: b.event_item_id,
      opportunity_ids: b.opportunity_ids as string[],
      attendance_type: aType,
      evidence_url: typeof b.evidence_url === "string" ? b.evidence_url : undefined,
      evidence_snippet: typeof b.evidence_snippet === "string" ? b.evidence_snippet : undefined,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  if (!authenticateServiceRequest(req)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or missing authentication");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const validation = validateInput(body);
  if (!validation.valid) {
    return jsonError(400, "VALIDATION_ERROR", validation.error);
  }

  const { run_id, event_item_id, opportunity_ids, attendance_type, evidence_url, evidence_snippet } = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Get event info
  const { data: eventItem } = await supabase
    .from("discovered_items")
    .select("id, title, event_date, canonical_url")
    .eq("id", event_item_id)
    .maybeSingle();

  if (!eventItem) {
    return jsonError(404, "NOT_FOUND", `Discovered item ${event_item_id} not found`);
  }

  const eventTitle = eventItem.title || "Unknown Event";
  const eventDate = eventItem.event_date || null;
  const eventUrl = eventItem.canonical_url || null;

  let attendanceInserted = 0;
  let attendanceDupes = 0;
  let edgesCreated = 0;
  let coattendanceEdges = 0;
  let signalsCreated = 0;

  // Upsert attendance rows for each opportunity
  for (const oppId of opportunity_ids) {
    const { error: attErr } = await supabase
      .from("event_attendance")
      .insert({
        opportunity_id: oppId,
        event_discovered_item_id: event_item_id,
        run_id,
        attendance_type: attendance_type || "attended",
        evidence_url: evidence_url || null,
        evidence_snippet: evidence_snippet || null,
      });

    if (attErr) {
      if (attErr.code === "23505") {
        attendanceDupes++;
      } else {
        console.error(`[event-coattendance] Attendance insert error for opp ${oppId}:`, attErr.message);
      }
      continue;
    }
    attendanceInserted++;

    // Upsert org → event edge
    const { error: edgeErr } = await supabase
      .from("relationship_edges")
      .upsert({
        source_type: "organization",
        source_id: oppId,
        target_type: "event",
        target_id: event_item_id,
        edge_reason: evidence_snippet || `Event attendance: ${eventTitle}`,
      }, { onConflict: "source_type,source_id,target_type,target_id", ignoreDuplicates: true });

    if (!edgeErr) edgesCreated++;

    // Emit opportunity signal
    const signalFingerprint = `event_attendance:${oppId}:${event_item_id}`;
    const dateLabel = eventDate ? ` (${eventDate})` : "";
    const { error: sigErr } = await supabase
      .from("opportunity_signals")
      .upsert({
        run_id,
        opportunity_id: oppId,
        signal_type: "event_attendance",
        signal_value: `${(attendance_type || "attended") === "attended" ? "Attending" : (attendance_type || "attended").charAt(0).toUpperCase() + (attendance_type || "attended").slice(1)} ${eventTitle}${dateLabel}`,
        confidence: 0.7,
        source_url: eventUrl,
        detected_at: new Date().toISOString(),
        signal_fingerprint: signalFingerprint,
      }, { onConflict: "signal_fingerprint", ignoreDuplicates: true });

    if (!sigErr) signalsCreated++;
  }

  // Co-attendance detection: find other orgs attending this event (within 180 days)
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { data: coAttendees } = await supabase
    .from("event_attendance")
    .select("opportunity_id")
    .eq("event_discovered_item_id", event_item_id)
    .gte("created_at", sixMonthsAgo);

  if (coAttendees && coAttendees.length > 1) {
    const allOppIds = coAttendees.map((a: { opportunity_id: string }) => a.opportunity_id);

    // Create pairwise org↔org edges for new opportunity_ids
    for (const newOppId of opportunity_ids) {
      for (const existingOppId of allOppIds) {
        if (existingOppId === newOppId) continue;

        // Create directed edge: new → existing
        const { error: coErr } = await supabase
          .from("relationship_edges")
          .upsert({
            source_type: "organization",
            source_id: newOppId,
            target_type: "organization",
            target_id: existingOppId,
            edge_reason: `Co-attended event: ${eventTitle}${eventDate ? ` (${eventDate})` : ""}`,
          }, { onConflict: "source_type,source_id,target_type,target_id", ignoreDuplicates: true });

        if (!coErr) coattendanceEdges++;
      }
    }
  }

  console.log(`[event-coattendance] event=${event_item_id}: ${attendanceInserted} inserted, ${attendanceDupes} dupes, ${edgesCreated} edges, ${coattendanceEdges} co-attendance, ${signalsCreated} signals`);

  return jsonOk({
    ok: true,
    event_item_id,
    run_id,
    stats: {
      attendance_inserted: attendanceInserted,
      attendance_dupes: attendanceDupes,
      edges_created: edgesCreated,
      coattendance_edges: coattendanceEdges,
      signals_created: signalsCreated,
    },
  });
});
