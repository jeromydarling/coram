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

// ── Canonicalization ──

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PersonEntry {
  name: string | null;
  title: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  source_url: string | null;
  evidence: string | null;
  confidence: number | null;
}

export function normalizeName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ");
}

export function canonicalKey(person: PersonEntry): string {
  const n = normalizeName(person.name).toLowerCase();
  const t = (person.title || "").trim().toLowerCase();
  const o = (person.organization_name || "").trim().toLowerCase();
  return `${n}|${t}|${o}`;
}

export function dedupeRoster(people: PersonEntry[]): PersonEntry[] {
  const map = new Map<string, PersonEntry>();
  for (const p of people) {
    const key = canonicalKey(p);
    if (!key || key === "||") continue;
    const existing = map.get(key);
    if (!existing || (p.confidence ?? 0) > (existing.confidence ?? 0)) {
      map.set(key, {
        name: normalizeName(p.name) || null,
        title: (p.title || "").trim() || null,
        organization_name: (p.organization_name || "").trim() || null,
        email: (p.email || "").trim() || null,
        phone: (p.phone || "").trim() || null,
        source_url: p.source_url || null,
        evidence: p.evidence || null,
        confidence: p.confidence ?? null,
      });
    }
  }
  return Array.from(map.values());
}

// ── Diff computation ──

const LEADERSHIP_RE = /\b(chief|ceo|cfo|cto|coo|president|vice\s*president|vp|director|board|executive)\b/i;

export function isLeadershipTitle(title: string | null): boolean {
  if (!title) return false;
  return LEADERSHIP_RE.test(title);
}

interface DiffResult {
  added: PersonEntry[];
  removed: PersonEntry[];
  changed: Array<{ before: PersonEntry; after: PersonEntry; change_type: string }>;
  summary: string;
}

export function computeDiff(oldRoster: PersonEntry[], newRoster: PersonEntry[]): DiffResult {
  // Match by normalized name (case-insensitive)
  const oldByName = new Map<string, PersonEntry>();
  for (const p of oldRoster) {
    const n = normalizeName(p.name).toLowerCase();
    if (n) oldByName.set(n, p);
  }

  const newByName = new Map<string, PersonEntry>();
  for (const p of newRoster) {
    const n = normalizeName(p.name).toLowerCase();
    if (n) newByName.set(n, p);
  }

  const added: PersonEntry[] = [];
  const removed: PersonEntry[] = [];
  const changed: Array<{ before: PersonEntry; after: PersonEntry; change_type: string }> = [];

  for (const [name, newP] of newByName) {
    const oldP = oldByName.get(name);
    if (!oldP) {
      added.push(newP);
    } else {
      const titleDiff = (oldP.title || "").toLowerCase() !== (newP.title || "").toLowerCase();
      const orgDiff = (oldP.organization_name || "").toLowerCase() !== (newP.organization_name || "").toLowerCase();
      if (titleDiff) {
        changed.push({ before: oldP, after: newP, change_type: "title_changed" });
      } else if (orgDiff) {
        changed.push({ before: oldP, after: newP, change_type: "org_changed" });
      }
    }
  }

  for (const [name, oldP] of oldByName) {
    if (!newByName.has(name)) {
      removed.push(oldP);
    }
  }

  const parts: string[] = [];
  if (added.length > 0) parts.push(`${added.length} added`);
  if (removed.length > 0) parts.push(`${removed.length} removed`);
  if (changed.length > 0) parts.push(`${changed.length} changed`);
  const summary = parts.length > 0 ? parts.join(", ") : "No changes";

  return { added, removed, changed, summary };
}

// ── Validate input ──

interface RosterDiffInput {
  run_id: string;
  opportunity_id: string;
  people: PersonEntry[];
}

export function validateInput(body: unknown): { valid: true; data: RosterDiffInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.run_id !== "string" || !UUID_RE.test(b.run_id)) {
    return { valid: false, error: "run_id: required valid UUID" };
  }
  if (typeof b.opportunity_id !== "string" || !UUID_RE.test(b.opportunity_id)) {
    return { valid: false, error: "opportunity_id: required valid UUID" };
  }
  if (!Array.isArray(b.people)) {
    return { valid: false, error: "people: required array" };
  }

  return {
    valid: true,
    data: {
      run_id: b.run_id,
      opportunity_id: b.opportunity_id,
      people: b.people as PersonEntry[],
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

  const { run_id, opportunity_id, people } = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Canonicalize roster
  const roster = dedupeRoster(people);

  // Check idempotency — if snapshot already exists for (opportunity_id, run_id)
  const { data: existingSnapshot } = await supabase
    .from("people_roster_snapshots")
    .select("id")
    .eq("opportunity_id", opportunity_id)
    .eq("run_id", run_id)
    .maybeSingle();

  if (existingSnapshot) {
    // Already processed — find the diff too
    const { data: existingDiff } = await supabase
      .from("people_roster_diffs")
      .select("id")
      .eq("opportunity_id", opportunity_id)
      .eq("run_id", run_id)
      .maybeSingle();

    return jsonOk({
      ok: true,
      duplicate: true,
      opportunity_id,
      run_id,
      snapshot_id: existingSnapshot.id,
      diff_id: existingDiff?.id || null,
    });
  }

  // Insert new snapshot
  const { data: snapshot, error: snapErr } = await supabase
    .from("people_roster_snapshots")
    .insert({ opportunity_id, run_id, roster })
    .select("id")
    .single();

  if (snapErr) {
    // Unique violation race
    if (snapErr.code === "23505") {
      const { data: raced } = await supabase
        .from("people_roster_snapshots")
        .select("id")
        .eq("opportunity_id", opportunity_id)
        .eq("run_id", run_id)
        .maybeSingle();
      return jsonOk({ ok: true, duplicate: true, snapshot_id: raced?.id });
    }
    return jsonError(500, "DB_ERROR", `Snapshot insert failed: ${snapErr.message}`);
  }

  // Fetch previous snapshot
  const { data: prevSnapshot } = await supabase
    .from("people_roster_snapshots")
    .select("id, roster")
    .eq("opportunity_id", opportunity_id)
    .neq("id", snapshot.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const oldRoster: PersonEntry[] = prevSnapshot?.roster ? (prevSnapshot.roster as PersonEntry[]) : [];
  const diff = computeDiff(oldRoster, roster);

  // Insert diff
  const { data: diffRow, error: diffErr } = await supabase
    .from("people_roster_diffs")
    .insert({
      opportunity_id,
      run_id,
      previous_snapshot_id: prevSnapshot?.id || null,
      current_snapshot_id: snapshot.id,
      diff,
    })
    .select("id")
    .single();

  if (diffErr && diffErr.code !== "23505") {
    console.error("[people-roster-diff] Diff insert error:", diffErr.message);
  }

  // Generate opportunity_signals for leadership changes
  let leadershipChange = false;
  const signals: Array<Record<string, unknown>> = [];

  // Check added people with leadership titles
  for (const p of diff.added) {
    if (isLeadershipTitle(p.title)) {
      leadershipChange = true;
      signals.push({
        run_id,
        opportunity_id,
        signal_type: "leadership_change",
        signal_value: `New ${p.title}: ${p.name}`,
        confidence: Math.min(p.confidence ?? 0.7, 1),
        source_url: p.source_url || null,
        detected_at: new Date().toISOString(),
        signal_fingerprint: `leadership:add:${normalizeName(p.name).toLowerCase()}:${opportunity_id}`,
      });
    }
  }

  // Check removed people with leadership titles
  for (const p of diff.removed) {
    if (isLeadershipTitle(p.title)) {
      leadershipChange = true;
      signals.push({
        run_id,
        opportunity_id,
        signal_type: "leadership_change",
        signal_value: `Departed ${p.title}: ${p.name}`,
        confidence: Math.min(p.confidence ?? 0.6, 1),
        source_url: p.source_url || null,
        detected_at: new Date().toISOString(),
        signal_fingerprint: `leadership:remove:${normalizeName(p.name).toLowerCase()}:${opportunity_id}`,
      });
    }
  }

  // Check title changes involving leadership
  for (const c of diff.changed) {
    if (isLeadershipTitle(c.before.title) || isLeadershipTitle(c.after.title)) {
      leadershipChange = true;
      signals.push({
        run_id,
        opportunity_id,
        signal_type: "leadership_change",
        signal_value: `Title change: ${c.after.name} (${c.before.title} → ${c.after.title})`,
        confidence: Math.min(c.after.confidence ?? 0.7, 1),
        source_url: c.after.source_url || c.before.source_url || null,
        detected_at: new Date().toISOString(),
        signal_fingerprint: `leadership:change:${normalizeName(c.after.name).toLowerCase()}:${opportunity_id}`,
      });
    } else {
      // Non-leadership team change
      signals.push({
        run_id,
        opportunity_id,
        signal_type: "info",
        signal_value: `${c.change_type}: ${c.after.name} (${c.before.title || "N/A"} → ${c.after.title || "N/A"})`,
        confidence: Math.min(c.after.confidence ?? 0.5, 1),
        source_url: c.after.source_url || null,
        detected_at: new Date().toISOString(),
        signal_fingerprint: `team:change:${normalizeName(c.after.name).toLowerCase()}:${opportunity_id}`,
      });
    }
  }

  if (signals.length > 0) {
    const { error: sigErr } = await supabase
      .from("opportunity_signals")
      .upsert(signals, { onConflict: "signal_fingerprint", ignoreDuplicates: true });

    if (sigErr) {
      console.error("[people-roster-diff] Signal upsert error:", sigErr.message);
    }
  }

  console.log(`[people-roster-diff] opp=${opportunity_id} run=${run_id}: ${diff.summary}, leadership=${leadershipChange}`);

  return jsonOk({
    ok: true,
    opportunity_id,
    run_id,
    snapshot_id: snapshot.id,
    diff_id: diffRow?.id || null,
    leadership_change: leadershipChange,
    stats: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
    },
  });
});
