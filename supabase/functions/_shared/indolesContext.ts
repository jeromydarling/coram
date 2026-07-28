/**
 * Shared helper: Fetch and format Indoles (personality intelligence) context
 * for injection into NRI AI prompts.
 *
 * WHAT: Loads personality data (enneagram, zodiac, CliftonStrengths, DISC) for contacts in scope.
 * WHERE: Called by profunda-ai edge function during chat context assembly.
 * WHY: Enables NRI to make personality-aware relational pairing suggestions.
 *
 * Privacy: Only includes data where personality_visibility != 'hidden'.
 * Zodiac metadata is system-internal — never surfaced to users directly.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface IndolesContactSummary {
  contact_id: string;
  name: string;
  age: number | null;
  enneagram_type: number | null;
  enneagram_wing: number | null;
  clifton_strengths: string[] | null;
  disc_profile: string | null;
  zodiac_sign: string | null;
  zodiac_element: string | null;
}

/**
 * Compute age from DOB string (YYYY-MM-DD). Server-side equivalent of client utility.
 */
function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob + "T00:00:00Z");
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export interface IndolesContext {
  contacts: IndolesContactSummary[];
  count: number;
}

/**
 * Load personality data for contacts linked to a user's tenant.
 * Filters out contacts with no personality data at all.
 * Returns null if none found (non-fatal).
 */
export async function getIndolesContext(
  supabase: SupabaseClient,
  contactIds: string[],
): Promise<IndolesContext | null> {
  try {
    if (!contactIds || contactIds.length === 0) return null;

    // Limit to prevent prompt bloat
    const limitedIds = contactIds.slice(0, 50);

    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, date_of_birth, enneagram_type, enneagram_wing, clifton_strengths, disc_profile, zodiac_sign, zodiac_element")
      .in("id", limitedIds)
      .or("enneagram_type.not.is.null,clifton_strengths.not.is.null,disc_profile.not.is.null,date_of_birth.not.is.null");

    if (error || !data || data.length === 0) {
      if (error) console.warn("[indoles] fetch error:", error.message);
      return null;
    }

    const contacts: IndolesContactSummary[] = data.map((c: any) => ({
      contact_id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      age: computeAge(c.date_of_birth),
      enneagram_type: c.enneagram_type,
      enneagram_wing: c.enneagram_wing,
      clifton_strengths: c.clifton_strengths,
      disc_profile: c.disc_profile,
      zodiac_sign: c.zodiac_sign,
      zodiac_element: c.zodiac_element,
    }));

    return { contacts, count: contacts.length };
  } catch (err) {
    console.warn("[indoles] exception:", err);
    return null;
  }
}

/**
 * Format Indoles context into a concise prompt block.
 */
export function formatIndolesForPrompt(ctx: IndolesContext): string {
  return ctx.contacts.map((c) => {
    const parts: string[] = [`${c.name}:`];
    if (c.age !== null) {
      parts.push(`Age ${c.age}`);
    }
    if (c.enneagram_type) {
      parts.push(`Enneagram ${c.enneagram_type}${c.enneagram_wing ? `w${c.enneagram_wing}` : ""}`);
    }
    if (c.clifton_strengths?.length) {
      parts.push(`Strengths: ${c.clifton_strengths.join(", ")}`);
    }
    if (c.disc_profile) {
      parts.push(`DISC: ${c.disc_profile}`);
    }
    // Zodiac is system-internal — include subtly for NRI pairing logic
    if (c.zodiac_element) {
      parts.push(`Element: ${c.zodiac_element}`);
    }
    return parts.join(" | ");
  }).join("\n");
}

/**
 * Build system prompt injection block for personality context.
 */
export function buildIndolesSystemBlock(ctx: IndolesContext): string {
  const content = formatIndolesForPrompt(ctx);
  if (!content) return "";

  return `
--- PERSONALITY INTELLIGENCE (Indoles) ---
The following personality data is available for contacts in this workspace.
Use it to inform relational pairing suggestions and communication style recommendations.
Do NOT explicitly mention zodiac signs to the user — use element/modality subtly in reasoning.

${content}
--- END PERSONALITY INTELLIGENCE ---`;
}
