import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { normalizeState } from "../_shared/stateFips.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
}

/** Check if a value is a garbage placeholder */
function isGarbage(v: string | null | undefined): boolean {
  if (!v || typeof v !== "string") return true;
  const trimmed = v.trim();
  if (!trimmed) return true;
  return /^(information not available|not found|n\/a|unknown|none|not available|not specified|tbd|to be determined)$/i.test(trimmed);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Resolve userId: try JWT claims first, fall back to service-role admin lookup ──
    let userId: string | null = null;
    let isServiceRole = false;

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (!claimsError && claimsData?.claims?.sub) {
      userId = claimsData.claims.sub as string;
    } else if (token === SUPABASE_SERVICE_ROLE_KEY) {
      // Service-role caller (e.g., opportunity-auto-enrich) — resolve an admin user
      isServiceRole = true;
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      userId = adminRole?.user_id ?? null;
    }

    if (!userId) return jsonError("Invalid token", 401);

    // ADMIN ONLY (skip check for service-role callers — they're already trusted)
    if (!isServiceRole) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      // deno-lint-ignore no-explicit-any
      const isAdmin = (roles || []).some((r: any) => r.role === "admin");
      if (!isAdmin) return jsonError("Admin access required", 403);
    }

    const body = await req.json();
    const { org_id } = body;
    if (!org_id) return jsonError("org_id is required");

    // ── Load opportunity ──
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("id, organization, mission_snapshot, best_partnership_angle, grant_alignment, address_line1, city, state, state_code, state_fips, zip, website_url, notes")
      .eq("id", org_id)
      .maybeSingle();

    if (oppErr) throw new Error(`Failed to load opportunity: ${oppErr.message}`);
    if (!opp) return jsonError("Organization not found", 404);

    // ── Load active org knowledge snapshot ──
    const { data: snapshot, error: snapErr } = await supabase
      .from("org_knowledge_snapshots")
      .select("id, version, structured_json")
      .eq("org_id", org_id)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapErr) throw new Error(`Failed to load org knowledge: ${snapErr.message}`);
    if (!snapshot) {
      return jsonResponse({
        ok: true,
        enriched: false,
        message: "No organization knowledge found. Generate it first, then enrich.",
        fields_updated: [],
      });
    }

    const profile = snapshot.structured_json as Record<string, unknown>;
    // deno-lint-ignore no-explicit-any
    const updates: Record<string, any> = {};
    const fieldsUpdated: string[] = [];

    // ── Mission → mission_snapshot (full sentences, not truncated) ──
    const mission = profile.mission as string | undefined;
    if (mission && !isGarbage(mission)) {
      const currentMission = opp.mission_snapshot as string[] | null;
      if (!currentMission || currentMission.length === 0 || currentMission.every((m: string) => isGarbage(m))) {
        // Split into sentences, keep full text (these are displayed as tags/chips)
        const sentences = mission.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 10).slice(0, 3);
        if (sentences.length > 0) {
          updates.mission_snapshot = sentences;
          fieldsUpdated.push("mission_snapshot");
        }
      }
    }

    // ── Partnership angles → best_partnership_angle (full text) ──
    const angles = profile.partnership_angles as string[] | undefined;
    if (angles && angles.length > 0) {
      const current = opp.best_partnership_angle as string[] | null;
      if (!current || current.length === 0) {
        updates.best_partnership_angle = angles.slice(0, 5);
        fieldsUpdated.push("best_partnership_angle");
      }
    }

    // ── Programs + who_we_serve → grant_alignment (if empty) ──
    const programs = profile.programs as Array<{ name: string; summary: string }> | undefined;
    const whoWeServe = (profile.who_we_serve || profile.who_they_serve) as string[] | undefined;
    const currentGrant = opp.grant_alignment as string[] | null;
    if ((!currentGrant || currentGrant.length === 0) && (programs || whoWeServe)) {
      const alignmentItems: string[] = [];
      if (whoWeServe) {
        whoWeServe.slice(0, 3).forEach((w: string) => alignmentItems.push(w));
      }
      if (programs) {
        programs.slice(0, 3).forEach((p: { name: string }) => alignmentItems.push(p.name));
      }
      if (alignmentItems.length > 0) {
        updates.grant_alignment = alignmentItems.slice(0, 5);
        fieldsUpdated.push("grant_alignment");
      }
    }

    // ── Headquarters → location fields (overwrite if org knowledge has valid data) ──
    // Org knowledge HQ is authoritative — always prefer it over stale opportunity data
    const hq = profile.headquarters as { address_line1?: string; city?: string; state?: string; zip?: string } | undefined;
    if (hq) {
      if (hq.address_line1 && !isGarbage(hq.address_line1) && opp.address_line1 !== hq.address_line1) {
        updates.address_line1 = hq.address_line1;
        fieldsUpdated.push("address_line1");
      }
      if (hq.city && !isGarbage(hq.city) && opp.city !== hq.city) {
        updates.city = hq.city;
        fieldsUpdated.push("city");
      }
      if (hq.zip && !isGarbage(hq.zip) && opp.zip !== hq.zip) {
        updates.zip = hq.zip;
        fieldsUpdated.push("zip");
      }
      if (hq.state && !isGarbage(hq.state)) {
        const normalized = normalizeState(hq.state);
        if (normalized) {
          if (opp.state !== normalized.stateName) {
            updates.state = normalized.stateName;
            fieldsUpdated.push("state");
          }
          if (opp.state_code !== normalized.stateCode) {
            updates.state_code = normalized.stateCode;
            fieldsUpdated.push("state_code");
          }
          if (opp.state_fips !== normalized.stateFips) {
            updates.state_fips = normalized.stateFips;
            fieldsUpdated.push("state_fips");
          }
        }
      }
    }

    // ── Programs summary → append to notes (if notes are empty) ──
    if (programs && programs.length > 0 && isGarbage(opp.notes)) {
      const programSummary = programs
        .slice(0, 5)
        .map((p: { name: string; summary: string }) => `• ${p.name}: ${p.summary}`)
        .join("\n");
      updates.notes = `Programs (from Org Knowledge v${snapshot.version}):\n${programSummary}`;
      fieldsUpdated.push("notes");
    }

    // ── Apply updates ──
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("opportunities")
        .update(updates)
        .eq("id", org_id);

      if (updateErr) throw new Error(`Failed to update opportunity: ${updateErr.message}`);
    }

    // ── Insert org_knowledge_profiles (idempotent, best-effort) ──
    let profileInitialized = false;
    try {
      const { data: existingProfile } = await supabase
        .from("org_knowledge_profiles")
        .select("organization_id")
        .eq("organization_id", org_id)
        .maybeSingle();

      if (existingProfile) {
        profileInitialized = false;
      } else {
        const defaultProfile = {
          organization_id: org_id,
          event_targeting_profile: {
            preferred_event_types: [],
            excluded_event_types: [],
            audience_level: null,
            attendance_mode: [],
          },
          geo_reach_profile: {
            primary_metros: [],
            secondary_metros: [],
            national_presence: false,
          },
          grant_alignment_vectors: {
            focus_areas: [],
            program_types: [],
          },
          ecosystem_scope: {
            sectors: [],
          },
        };

        const { error: insertErr } = await supabase
          .from("org_knowledge_profiles")
          .insert(defaultProfile);

        if (insertErr) {
          // 23505 = unique violation → race condition, profile existed
          profileInitialized = insertErr.code === "23505" ? false : false;
          if (insertErr.code !== "23505") {
            console.error("org_knowledge_profiles insert warning:", insertErr.message);
          }
        } else {
          profileInitialized = true;
        }
      }
    } catch (profileErr) {
      console.error("org_knowledge_profiles insert failed:", profileErr);
      profileInitialized = false;
    }

    return jsonResponse({
      ok: true,
      enriched: fieldsUpdated.length > 0,
      message: fieldsUpdated.length > 0
        ? `Enriched ${fieldsUpdated.length} field(s) from Org Knowledge v${snapshot.version}`
        : "All fields already populated — nothing to backfill from Org Knowledge",
      fields_updated: fieldsUpdated,
      knowledge_version: snapshot.version,
      profile_initialized: profileInitialized,
    });
  } catch (error) {
    console.error("enrich-from-knowledge error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
