/**
 * Shared helper: Fetch and format authoritative org knowledge for AI prompt injection.
 * 
 * Used by all AI edge functions to automatically include org profile context.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface OrgKnowledgeProfile {
  org_name: string;
  mission: string;
  positioning?: string;
  who_we_serve?: string[];
  who_they_serve?: string[]; // legacy field name
  geographies?: string[];
  programs?: Array<{ name: string; summary: string }>;
  key_stats?: Array<{ label: string; value: string }>;
  tone_keywords?: string[];
  approved_claims?: string[];
  disallowed_claims?: string[];
  partnership_angles?: string[];
  sources?: Array<{ url: string; quote: string }>;
}

export interface OrgKnowledgeContext {
  snapshot_id: string;
  version: number;
  org_profile_json: OrgKnowledgeProfile;
  org_profile_text: string;
}

/**
 * Fetch the current active authoritative org knowledge snapshot.
 * Returns null if none exists (non-fatal).
 */
export async function getOrgKnowledgeContext(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgKnowledgeContext | null> {
  try {
    const { data, error } = await supabase
      .from("org_knowledge_snapshots")
      .select("id, version, structured_json")
      .eq("org_id", orgId)
      .eq("active", true)
      .eq("is_authoritative", true)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn(`[org-knowledge] fetch error for org ${orgId}:`, error.message);
      return null;
    }

    const profile = data.structured_json as OrgKnowledgeProfile;
    if (!profile || typeof profile !== "object") return null;

    return {
      snapshot_id: data.id,
      version: data.version,
      org_profile_json: profile,
      org_profile_text: formatOrgProfileForPrompt(profile),
    };
  } catch (err) {
    console.warn(`[org-knowledge] exception for org ${orgId}:`, err);
    return null;
  }
}

/**
 * Format the structured org profile into a deterministic text block for AI prompts.
 */
export function formatOrgProfileForPrompt(profile: OrgKnowledgeProfile): string {
  const lines: string[] = [];

  if (profile.org_name) lines.push(`Organization: ${profile.org_name}`);
  if (profile.mission) lines.push(`Mission: ${profile.mission}`);
  if (profile.positioning) lines.push(`Positioning: ${profile.positioning}`);

  const serveList = profile.who_we_serve || profile.who_they_serve || [];
  if (serveList.length > 0) lines.push(`Who We Serve: ${serveList.join(", ")}`);

  if (profile.geographies?.length) lines.push(`Geographies: ${profile.geographies.join(", ")}`);

  if (profile.programs?.length) {
    lines.push("Programs:");
    for (const p of profile.programs) {
      lines.push(`  - ${p.name}: ${p.summary}`);
    }
  }

  if (profile.key_stats?.length) {
    lines.push("Key Stats:");
    for (const s of profile.key_stats) {
      lines.push(`  - ${s.label}: ${s.value}`);
    }
  }

  if (profile.tone_keywords?.length) lines.push(`Tone: ${profile.tone_keywords.join(", ")}`);

  if (profile.approved_claims?.length) {
    lines.push("Approved Claims (use these):");
    for (const c of profile.approved_claims) {
      lines.push(`  ✓ ${c}`);
    }
  }

  if (profile.disallowed_claims?.length) {
    lines.push("Disallowed Claims (do NOT use):");
    for (const c of profile.disallowed_claims) {
      lines.push(`  ✗ ${c}`);
    }
  }

  if (profile.partnership_angles?.length) {
    lines.push(`Partnership Angles: ${profile.partnership_angles.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Build the system prompt injection block for org knowledge.
 */
export function buildOrgKnowledgeSystemBlock(ctx: OrgKnowledgeContext): string {
  return `
--- AUTHORITATIVE ORGANIZATION PROFILE (v${ctx.version}) ---
The following organization profile is authoritative. Do not contradict it. Do not invent claims not supported by it.

${ctx.org_profile_text}
--- END ORGANIZATION PROFILE ---`;
}
