/**
 * prospect-pack-worker — Pure LLM worker.
 *
 * WHAT: Assembles all known intelligence about an opportunity → LLM generates prospect pack.
 * WHERE: Called internally by dispatch or opportunity-auto-enrich.
 * WHY: Eliminates n8n dependency for prospect_pack_generate workflow.
 *
 * Input: { run_id, entity_id, entity_type?, org_name?, context? }
 * Output: Writes to prospect_packs table.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateWorkerRequest, jsonOk, jsonError, corsHeaders } from "../_shared/workerAuth.ts";
import { callLlm } from "../_shared/llmGateway.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST only");
  if (!authenticateWorkerRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid auth");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, "INVALID_JSON", "Invalid JSON"); }

  const run_id = body.run_id as string;
  const entity_id = body.entity_id as string;
  const entity_type = (body.entity_type as string) || "opportunity";

  if (!run_id || !entity_id) return jsonError(400, "MISSING_FIELD", "run_id and entity_id required");

  try {
    // Idempotency
    const { data: existing } = await supabase.from("prospect_packs").select("id").eq("run_id", run_id).maybeSingle();
    if (existing) return jsonOk({ ok: true, duplicate: true, run_id, id: existing.id });

    // Assemble context
    const [oppResult, factsResult, signalsResult, contactsResult, activitiesResult] = await Promise.all([
      supabase.from("opportunities").select("*").eq("id", entity_id).maybeSingle(),
      supabase.from("org_enrichment_facts").select("*").eq("org_name", (body.org_name as string) || "").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("opportunity_signals").select("signal_type, signal_value, confidence, detected_at").eq("opportunity_id", entity_id).order("detected_at", { ascending: false }).limit(10),
      supabase.from("contacts").select("first_name, last_name, title, email").eq("opportunity_id", entity_id).limit(10),
      supabase.from("activities").select("activity_type, title, notes, activity_date_time").eq("opportunity_id", entity_id).order("activity_date_time", { ascending: false }).limit(5),
    ]);

    const opp = oppResult.data;
    const facts = factsResult.data;
    const neighborhood = body.neighborhood_context as string || "";

    const contextParts = [
      `Organization: ${opp?.organization || body.org_name || "Unknown"}`,
      opp?.mission ? `Mission: ${opp.mission}` : null,
      opp?.website ? `Website: ${opp.website}` : null,
      opp?.stage ? `Stage: ${opp.stage}` : null,
      facts ? `\nEnrichment Facts:\nMission: ${facts.mission_summary}\nPrograms: ${(facts.programs || []).join(", ")}\nPopulations: ${(facts.populations_served || []).join(", ")}\nGeographies: ${(facts.geographies || []).join(", ")}` : null,
      signalsResult.data?.length ? `\nRecent Signals:\n${signalsResult.data.map(s => `- ${s.signal_type}: ${s.signal_value} (${s.confidence})`).join("\n")}` : null,
      contactsResult.data?.length ? `\nKey Contacts:\n${contactsResult.data.map(c => `- ${c.first_name} ${c.last_name} (${c.title || "N/A"}) <${c.email || "N/A"}>`).join("\n")}` : null,
      activitiesResult.data?.length ? `\nRecent Activities:\n${activitiesResult.data.map(a => `- ${a.activity_type}: ${a.title || a.notes?.slice(0, 80) || "N/A"} (${a.activity_date_time})`).join("\n")}` : null,
      neighborhood ? `\nNeighborhood Context: ${neighborhood}` : null,
    ].filter(Boolean).join("\n");

    const llmResult = await callLlm(
      [
        {
          role: "system",
          content: `You are a nonprofit partnership strategist. Given all known intelligence about an organization, generate a comprehensive prospect pack.

Return ONLY valid JSON:
{
  "org_summary": "2-3 sentence overview",
  "mission_snapshot": "Core mission and values",
  "partnership_angles": ["3-5 specific partnership opportunities"],
  "grant_alignments": ["Potential grant/funding alignments"],
  "suggested_outreach_angle": "Best opening approach for outreach",
  "risks_notes": ["Potential concerns or risks"],
  "key_people": ["Key contacts and their roles"],
  "talking_points": ["3-5 conversation starters"]
}

Be specific and reference actual data. Never fabricate contacts or specifics not in the input.`,
        },
        { role: "user", content: contextParts },
      ],
      { model: "google/gemini-3-flash-preview", temperature: 0.3, timeoutMs: 45_000 },
    );

    let pack: Record<string, unknown> = {
      org_summary: `${opp?.organization || "Organization"} — basic prospect pack generated.`,
      mission_snapshot: opp?.mission || facts?.mission_summary || "Mission information not available.",
      partnership_angles: [],
      grant_alignments: [],
      suggested_outreach_angle: "General introduction and exploration of partnership opportunities.",
      risks_notes: [],
    };

    if (llmResult.ok && llmResult.content) {
      const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          pack = {
            org_summary: parsed.org_summary || pack.org_summary,
            mission_snapshot: parsed.mission_snapshot || pack.mission_snapshot,
            partnership_angles: Array.isArray(parsed.partnership_angles) ? parsed.partnership_angles : [],
            grant_alignments: Array.isArray(parsed.grant_alignments) ? parsed.grant_alignments : [],
            suggested_outreach_angle: parsed.suggested_outreach_angle || pack.suggested_outreach_angle,
            risks_notes: Array.isArray(parsed.risks_notes) ? parsed.risks_notes : [],
            key_people: Array.isArray(parsed.key_people) ? parsed.key_people : undefined,
            talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points : undefined,
          };
        } catch { /* use defaults */ }
      }
    }

    // Insert prospect pack
    const { data: inserted, error: insertErr } = await supabase
      .from("prospect_packs")
      .insert({ entity_type, entity_id, run_id, pack_json: pack })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") return jsonOk({ ok: true, duplicate: true, run_id });
      throw new Error(`prospect_packs insert failed: ${insertErr.message}`);
    }

    return jsonOk({ ok: true, run_id, id: inserted.id, ai_used: true });
  } catch (err) {
    console.error("[prospect-pack-worker] Error:", err);
    return jsonError(500, "PROCESSING_ERROR", err instanceof Error ? err.message : String(err));
  }
});
