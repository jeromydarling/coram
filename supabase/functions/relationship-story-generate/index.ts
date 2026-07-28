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

function authenticateServiceRequest(req: Request): { authenticated: boolean; isUser: boolean; token: string } {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  // Service role key
  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return { authenticated: true, isUser: false, token: "" };
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return { authenticated: false, isUser: false, token: "" };

  // Check server secrets
  const isServerSecret =
    (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);
  if (isServerSecret) return { authenticated: true, isUser: false, token: "" };

  // Treat as user JWT
  return { authenticated: true, isUser: true, token };
}

// ── Types ──

interface EvidenceItem {
  type: string;
  ts: string;
  url: string | null;
  snippet: string;
  source: string;
  id: string;
}

interface ChapterResult {
  family: string;
  chapter_id: string;
  wrote_update: boolean;
  delta_type: string | null;
  confidence: number | null;
}

// ── Chapter family mapping ──

const FAMILY_SIGNAL_MAP: Record<string, string[]> = {
  leadership: ["leadership_change", "hiring", "org_chart", "board_change", "executive_hire"],
  programs: ["program_launch", "service_expansion", "mission_update", "program_change"],
  ecosystem: ["partnership", "collaboration", "network", "coalition", "referral"],
  funding: ["grant_awarded", "funding", "grant_opportunity", "fundraising", "donation"],
  events: ["event", "conference", "summit", "workshop", "webinar"],
  relationship: ["outreach", "meeting", "engagement", "momentum"],
};

const FAMILY_DISCOVERY_MAP: Record<string, string[]> = {
  leadership: ["people"],
  programs: ["people"],
  ecosystem: ["people"],
  funding: ["grants"],
  events: ["events"],
  relationship: [],
};

function mapSignalToFamily(signalType: string): string | null {
  for (const [family, types] of Object.entries(FAMILY_SIGNAL_MAP)) {
    if (types.some(t => signalType.toLowerCase().includes(t))) return family;
  }
  return null;
}

function mapDiscoveredItemToFamily(module: string, title: string | null): string | null {
  const mod = module.toLowerCase();
  for (const [family, modules] of Object.entries(FAMILY_DISCOVERY_MAP)) {
    if (modules.includes(mod)) return family;
  }
  // Keyword fallback
  const text = (title ?? "").toLowerCase();
  if (/leader|ceo|director|executive|board|hire/i.test(text)) return "leadership";
  if (/grant|fund|award|donat/i.test(text)) return "funding";
  if (/event|conference|summit|workshop/i.test(text)) return "events";
  if (/partner|coalition|collaborat/i.test(text)) return "ecosystem";
  if (/program|service|mission/i.test(text)) return "programs";
  return null;
}

// ── Evidence collection ──

async function collectEvidence(
  supabase: ReturnType<typeof createClient>,
  opportunityId: string,
  windowDays: number,
): Promise<{
  signals: EvidenceItem[];
  edges: EvidenceItem[];
  discoveries: EvidenceItem[];
  momentum: { score: number; trend: string; score_delta: number; drivers: unknown[] } | null;
  opportunity: Record<string, unknown> | null;
  upcomingEvents: EvidenceItem[];
  journalColor: EvidenceItem[];
}> {
  const windowStart = new Date(Date.now() - windowDays * 86400000).toISOString();
  const edgeWindowStart = new Date(Date.now() - 90 * 86400000).toISOString();
  const futureWindow = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const [signalsRes, edgesRes, discoveriesRes, momentumRes, oppRes, eventsRes] = await Promise.all([
    supabase
      .from("opportunity_signals")
      .select("id, signal_type, signal_value, confidence, source_url, detected_at")
      .eq("opportunity_id", opportunityId)
      .gte("detected_at", windowStart)
      .order("detected_at", { ascending: false })
      .limit(100),
    supabase
      .from("relationship_edges")
      .select("id, source_type, target_type, edge_reason, created_at")
      .or(`source_id.eq.${opportunityId},target_id.eq.${opportunityId}`)
      .gte("created_at", edgeWindowStart)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("discovered_items")
      .select("id, module, title, snippet, canonical_url, event_date, first_seen_at, last_seen_at, discovery_item_links!inner(opportunity_id)")
      .eq("discovery_item_links.opportunity_id", opportunityId)
      .gte("first_seen_at", windowStart)
      .order("first_seen_at", { ascending: false })
      .limit(100),
    supabase
      .from("relationship_momentum")
      .select("score, trend, score_delta, drivers")
      .eq("opportunity_id", opportunityId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("opportunities")
      .select("organization, metro_id, partner_tiers, mission_snapshot, grant_alignment, best_partnership_angle, last_contact_date, next_action_due, owner_id")
      .eq("id", opportunityId)
      .single(),
    supabase
      .from("events")
      .select("id, event_name, event_date, slug")
      .eq("host_opportunity_id", opportunityId)
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .lte("event_date", futureWindow)
      .order("event_date", { ascending: true })
      .limit(20),
  ]);

  const signals: EvidenceItem[] = (signalsRes.data ?? []).map((s: Record<string, unknown>) => ({
    type: s.signal_type as string,
    ts: s.detected_at as string,
    url: s.source_url as string | null,
    snippet: s.signal_value as string,
    source: "opportunity_signals",
    id: s.id as string,
  }));

  const edges: EvidenceItem[] = (edgesRes.data ?? []).map((e: Record<string, unknown>) => ({
    type: `edge:${e.source_type}-${e.target_type}`,
    ts: e.created_at as string,
    url: null,
    snippet: e.edge_reason as string,
    source: "relationship_edges",
    id: e.id as string,
  }));

  const discoveries: EvidenceItem[] = (discoveriesRes.data ?? []).map((d: Record<string, unknown>) => ({
    type: `discovery:${d.module}`,
    ts: d.first_seen_at as string,
    url: d.canonical_url as string | null,
    snippet: (d.title ?? d.snippet ?? "") as string,
    source: "discovered_items",
    id: d.id as string,
  }));

  const upcomingEvents: EvidenceItem[] = (eventsRes.data ?? []).map((ev: Record<string, unknown>) => ({
    type: "upcoming_event",
    ts: ev.event_date as string,
    url: null,
    snippet: ev.event_name as string,
    source: "events",
    id: ev.id as string,
  }));

  // Journal color — blend journal extractions mentioning this opportunity's org
  const journalColor: EvidenceItem[] = [];
  const orgName = (oppRes.data as Record<string, unknown>)?.organization as string | undefined;
  const oppMetroId = (oppRes.data as Record<string, unknown>)?.metro_id as string | undefined;

  if (orgName && oppMetroId) {
    // Find journal extractions that mention this org
    const { data: journalEntries } = await supabase
      .from("journal_entries")
      .select("id, created_at")
      .eq("metro_id", oppMetroId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(20);

    if (journalEntries && journalEntries.length > 0) {
      const entryIds = journalEntries.map(j => j.id);
      const { data: extractions } = await supabase
        .from("journal_extractions")
        .select("journal_entry_id, extracted_json")
        .in("journal_entry_id", entryIds);

      const orgLower = orgName.toLowerCase();
      for (const ext of extractions ?? []) {
        const json = ext.extracted_json as Record<string, unknown>;
        const mentions = (json?.org_mentions ?? []) as Array<{ name: string; confidence: number }>;
        const mentionsOrg = mentions.some(m => m.name.toLowerCase().includes(orgLower) || orgLower.includes(m.name.toLowerCase()));
        if (mentionsOrg) {
          const entry = journalEntries.find(j => j.id === ext.journal_entry_id);
          if (entry) {
            // Never quote verbatim — convert to narrative color
            const topics = ((json?.topics ?? []) as string[]).slice(0, 2).join(", ");
            const colorSnippet = topics
              ? `On the ground, observers noted themes of ${topics}`
              : "Field observations suggest continued engagement";
            journalColor.push({
              type: "journal_color",
              ts: entry.created_at,
              url: null,
              snippet: colorSnippet,
              source: "journal_entries",
              id: entry.id,
            });
          }
        }
      }
    }
  }

  return {
    signals,
    edges,
    discoveries,
    momentum: momentumRes.data as { score: number; trend: string; score_delta: number; drivers: unknown[] } | null,
    opportunity: oppRes.data as Record<string, unknown> | null,
    upcomingEvents,
    journalColor,
  };
}

// ── Group evidence by family ──

function groupEvidenceByFamily(
  signals: EvidenceItem[],
  edges: EvidenceItem[],
  discoveries: EvidenceItem[],
  upcomingEvents: EvidenceItem[],
  momentum: { score: number; trend: string; score_delta: number; drivers: unknown[] } | null,
  opportunity: Record<string, unknown> | null,
  journalColor: EvidenceItem[] = [],
): Record<string, EvidenceItem[]> {
  const groups: Record<string, EvidenceItem[]> = {
    leadership: [],
    programs: [],
    ecosystem: [],
    funding: [],
    events: [],
    relationship: [],
  };

  // Signals
  for (const s of signals) {
    const family = mapSignalToFamily(s.type);
    if (family && groups[family]) groups[family].push(s);
  }

  // Edges → ecosystem
  for (const e of edges) {
    groups.ecosystem.push(e);
  }

  // Discoveries
  for (const d of discoveries) {
    const modPart = d.type.replace("discovery:", "");
    const family = mapDiscoveredItemToFamily(modPart, d.snippet);
    if (family && groups[family]) groups[family].push(d);
  }

  // Upcoming events
  for (const ev of upcomingEvents) {
    groups.events.push(ev);
  }

  // Relationship: momentum + opportunity-level signals
  if (momentum) {
    groups.relationship.push({
      type: "momentum",
      ts: new Date().toISOString(),
      url: null,
      snippet: `Score: ${momentum.score}, Trend: ${momentum.trend}, Delta: ${momentum.score_delta}`,
      source: "relationship_momentum",
      id: "momentum-latest",
    });
  }

  if (opportunity) {
    if (opportunity.last_contact_date) {
      groups.relationship.push({
        type: "last_contact",
        ts: opportunity.last_contact_date as string,
        url: null,
        snippet: `Last contact: ${opportunity.last_contact_date}`,
        source: "opportunities",
        id: "last-contact",
      });
    }
    // Mission snapshot → programs
    if (Array.isArray(opportunity.mission_snapshot) && (opportunity.mission_snapshot as string[]).length > 0) {
      groups.programs.push({
        type: "mission_snapshot",
        ts: new Date().toISOString(),
        url: null,
        snippet: (opportunity.mission_snapshot as string[]).join(", "),
        source: "opportunities",
        id: "mission-snapshot",
      });
    }
    // Grant alignment → funding
    if (Array.isArray(opportunity.grant_alignment) && (opportunity.grant_alignment as string[]).length > 0) {
      groups.funding.push({
        type: "grant_alignment",
        ts: new Date().toISOString(),
        url: null,
        snippet: (opportunity.grant_alignment as string[]).join(", "),
        source: "opportunities",
        id: "grant-alignment",
      });
    }
    // Best partnership angle → ecosystem
    if (Array.isArray(opportunity.best_partnership_angle) && (opportunity.best_partnership_angle as string[]).length > 0) {
      groups.ecosystem.push({
        type: "partnership_angle",
        ts: new Date().toISOString(),
        url: null,
        snippet: (opportunity.best_partnership_angle as string[]).join(", "),
        source: "opportunities",
        id: "partnership-angle",
      });
    }
  }

  // Journal color → relationship chapter (narrative texture, not verbatim)
  for (const jc of journalColor) {
    groups.relationship.push(jc);
  }

  return groups;
}

// ── Narrative generation (deterministic) ──

function generateNarrative(
  family: string,
  chapterTitle: string,
  evidence: EvidenceItem[],
  _orgName: string,
): { summary_md: string; delta_type: string; confidence: number } {
  if (evidence.length === 0) {
    return {
      summary_md: `No new developments in ${chapterTitle} during this period. The current landscape remains stable.`,
      delta_type: "noop",
      confidence: 0.3,
    };
  }

  const topEvidence = evidence.slice(0, 3);
  const evidenceLines = topEvidence.map(e => {
    const dateStr = e.ts ? new Date(e.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "recently";
    return `- **${dateStr}**: ${e.snippet}${e.url ? ` ([source](${e.url}))` : ""}`;
  }).join("\n");

  let openingLine: string;
  let deltaType: string;
  let confidence: number;

  // Determine delta type based on evidence composition
  const hasNewSignals = evidence.some(e => e.source === "opportunity_signals" || e.source === "discovered_items");
  const hasMomentum = evidence.some(e => e.type === "momentum");
  const hasLeadershipChange = evidence.some(e => /leader|ceo|director|executive|hire/i.test(e.snippet));

  if (hasLeadershipChange && family === "leadership") {
    openingLine = `Notable leadership developments have emerged at ${_orgName}.`;
    deltaType = "shift";
    confidence = 0.8;
  } else if (hasNewSignals) {
    openingLine = `New signals have surfaced related to ${chapterTitle.toLowerCase()}.`;
    deltaType = "new_signal";
    confidence = 0.7;
  } else if (hasMomentum) {
    openingLine = `The trajectory continues to evolve for ${chapterTitle.toLowerCase()}.`;
    deltaType = "reinforcement";
    confidence = 0.6;
  } else {
    openingLine = `The ${chapterTitle.toLowerCase()} picture remains consistent with recent observations.`;
    deltaType = "reinforcement";
    confidence = 0.5;
  }

  const watchLine = deltaType === "shift" || deltaType === "new_signal"
    ? `\n\nWorth keeping an eye on: ${topEvidence[0].snippet.slice(0, 100)}${topEvidence[0].snippet.length > 100 ? "…" : ""}.`
    : "";

  const summary_md = `${openingLine}\n\n${evidenceLines}${watchLine}`;

  return { summary_md, delta_type: deltaType, confidence };
}

// ── Delta detection (compare with last update for chapter) ──

async function shouldWriteUpdate(
  supabase: ReturnType<typeof createClient>,
  chapterId: string,
  currentEvidence: EvidenceItem[],
  force: boolean,
): Promise<{ write: boolean; isFirstUpdate: boolean }> {
  const { data: lastUpdate } = await supabase
    .from("relationship_story_updates")
    .select("id, evidence, delta_type")
    .eq("chapter_id", chapterId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastUpdate) return { write: true, isFirstUpdate: true };

  // Compare evidence IDs to detect new material
  const lastEvidenceIds = new Set(
    ((lastUpdate.evidence as EvidenceItem[]) ?? []).map(e => e.id),
  );
  const newEvidenceItems = currentEvidence.filter(
    e => e.id !== "momentum-latest" && e.id !== "last-contact" &&
      e.id !== "mission-snapshot" && e.id !== "grant-alignment" &&
      e.id !== "partnership-angle" && !lastEvidenceIds.has(e.id),
  );

  if (newEvidenceItems.length === 0 && !force) return { write: false, isFirstUpdate: false };
  return { write: true, isFirstUpdate: false };
}

// ── Notification targeting ──

async function notifyStoryUpdate(
  supabase: ReturnType<typeof createClient>,
  opportunityId: string,
  chapterFamily: string,
  chapterTitle: string,
  deltaType: string,
  confidence: number,
  generatedAt: string,
  ownerId: string | null,
  metroId: string | null,
): Promise<void> {
  // Only notify on meaningful shifts
  if (!["shift", "new_signal"].includes(deltaType) || confidence < 0.7) return;

  const dateBucket = generatedAt.slice(0, 10);
  const dedupeKey = `story:${opportunityId}:${chapterFamily}:${dateBucket}`;
  const payload = {
    dedupe_key: dedupeKey,
    opportunity_id: opportunityId,
    chapter_family: chapterFamily,
    chapter_title: chapterTitle,
    delta_type: deltaType,
    generated_at: generatedAt,
  };

  const userIds = new Set<string>();

  // 1) Owner first
  if (ownerId) userIds.add(ownerId);

  // 2) Metro assignments
  if (metroId) {
    const { data: metroUsers } = await supabase
      .from("user_metro_assignments")
      .select("user_id")
      .eq("metro_id", metroId)
      .limit(10);
    for (const u of metroUsers ?? []) {
      if (userIds.size >= 10) break;
      userIds.add(u.user_id);
    }
  }

  // 3) Admin/regional_lead fallback
  if (userIds.size === 0) {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "regional_lead"])
      .limit(5);
    for (const a of admins ?? []) {
      if (userIds.size >= 5) break;
      userIds.add(a.user_id);
    }
  }

  // Insert notifications (best effort, ignore conflicts from dedup index)
  const rows = Array.from(userIds).map(userId => ({
    user_id: userId,
    org_id: opportunityId,
    notification_type: "relationship_story_update",
    payload,
  }));

  if (rows.length > 0) {
    await supabase.from("proactive_notifications").insert(rows).throwOnError().catch(() => {});
  }
}

// ── Generate story for single opportunity ──

async function generateStoryForOpportunity(
  supabase: ReturnType<typeof createClient>,
  opportunityId: string,
  windowDays: number,
  force: boolean,
): Promise<{ chapters: ChapterResult[]; updates_written: number; error?: string }> {
  // Ensure chapters exist
  await supabase.rpc("ensure_story_chapters", { p_opportunity_id: opportunityId });

  // Collect evidence
  const { signals, edges, discoveries, momentum, opportunity, upcomingEvents, journalColor } =
    await collectEvidence(supabase, opportunityId, windowDays);

  const orgName = (opportunity?.organization as string) ?? "this organization";
  const ownerId = (opportunity?.owner_id as string) ?? null;
  const metroId = (opportunity?.metro_id as string) ?? null;

  // Group evidence by family
  const evidenceByFamily = groupEvidenceByFamily(signals, edges, discoveries, upcomingEvents, momentum, opportunity, journalColor);

  // Fetch chapters
  const { data: chapters } = await supabase
    .from("relationship_story_chapters")
    .select("id, family, chapter_title, is_active")
    .eq("opportunity_id", opportunityId)
    .order("chapter_order", { ascending: true });

  if (!chapters || chapters.length === 0) {
    return { chapters: [], updates_written: 0, error: "No chapters found" };
  }

  const results: ChapterResult[] = [];
  let updatesWritten = 0;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 86400000);

  for (const chapter of chapters) {
    if (!chapter.is_active) {
      results.push({ family: chapter.family, chapter_id: chapter.id, wrote_update: false, delta_type: null, confidence: null });
      continue;
    }

    const familyEvidence = evidenceByFamily[chapter.family] ?? [];

    const { write, isFirstUpdate } = await shouldWriteUpdate(
      supabase,
      chapter.id,
      familyEvidence,
      force,
    );

    if (!write) {
      results.push({ family: chapter.family, chapter_id: chapter.id, wrote_update: false, delta_type: null, confidence: null });
      continue;
    }

    let { summary_md, delta_type, confidence } = generateNarrative(
      chapter.family,
      chapter.chapter_title,
      familyEvidence,
      orgName,
    );

    // First update → always new_signal
    if (isFirstUpdate && delta_type === "reinforcement") {
      delta_type = "new_signal";
      confidence = Math.max(confidence, 0.7);
    }

    // Force mode with no real evidence → noop
    if (force && familyEvidence.length === 0) {
      delta_type = "noop";
    }

    const generatedAt = now.toISOString();

    // Insert the update
    const { error: insertErr } = await supabase
      .from("relationship_story_updates")
      .insert({
        chapter_id: chapter.id,
        opportunity_id: opportunityId,
        generated_at: generatedAt,
        window_start: windowStart.toISOString(),
        window_end: now.toISOString(),
        delta_type,
        confidence,
        summary_md,
        evidence: familyEvidence,
        ai_used: false,
        version: "v1",
      });

    if (insertErr) {
      console.error(`Failed to insert update for ${chapter.family}:`, insertErr.message);
      results.push({ family: chapter.family, chapter_id: chapter.id, wrote_update: false, delta_type: null, confidence: null });
      continue;
    }

    updatesWritten++;
    results.push({ family: chapter.family, chapter_id: chapter.id, wrote_update: true, delta_type, confidence });

    // Push notifications (best effort)
    try {
      await notifyStoryUpdate(supabase, opportunityId, chapter.family, chapter.chapter_title, delta_type, confidence, generatedAt, ownerId, metroId);
    } catch (e) {
      console.error("Notification error:", e);
    }
  }

  return { chapters: results, updates_written: updatesWritten };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = authenticateServiceRequest(req);
  if (!auth.authenticated) {
    return jsonError(401, "unauthorized", "Invalid or missing credentials");
  }

  // For user JWTs, verify they have admin/regional_lead role
  let supabase: ReturnType<typeof createClient>;
  if (auth.isUser) {
    // Create user-context client to verify role, but use service role for writes
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${auth.token}` } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonError(401, "unauthorized", "Invalid token");

    // Check role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const userRoles = (roles ?? []).map((r: { role: string }) => r.role);
    if (!userRoles.some(r => ["admin", "regional_lead", "leadership"].includes(r))) {
      return jsonError(403, "forbidden", "Requires admin or regional_lead role");
    }
    supabase = serviceClient;
  } else {
    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const opportunityId = body.opportunity_id as string | undefined;
    const windowDays = (body.window_days as number) || 30;
    const force = (body.force as boolean) || false;
    const mode = (body.mode as string) || (opportunityId ? "single" : "batch");

    if (mode === "single") {
      if (!opportunityId) {
        return jsonError(400, "missing_field", "opportunity_id required for single mode");
      }
      const result = await generateStoryForOpportunity(supabase, opportunityId, windowDays, force);
      return jsonOk({ ok: true, opportunity_id: opportunityId, ...result });
    }

    // Batch mode
    const { data: opportunities, error: fetchErr } = await supabase
      .from("opportunities")
      .select("id")
      .eq("status", "Active")
      .limit(500);

    if (fetchErr) {
      return jsonError(500, "db_error", fetchErr.message);
    }

    const batchResults: Array<{ opportunity_id: string; updates_written: number; error?: string }> = [];
    const errors: Array<{ opportunity_id: string; error: string }> = [];

    for (const opp of opportunities ?? []) {
      try {
        const result = await generateStoryForOpportunity(supabase, opp.id, windowDays, force);
        batchResults.push({ opportunity_id: opp.id, updates_written: result.updates_written });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        errors.push({ opportunity_id: opp.id, error: errMsg });
      }
    }

    return jsonOk({
      ok: true,
      mode: "batch",
      total: (opportunities ?? []).length,
      results: batchResults,
      errors,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("Story generation error:", errMsg);
    return jsonError(500, "internal_error", errMsg);
  }
});
