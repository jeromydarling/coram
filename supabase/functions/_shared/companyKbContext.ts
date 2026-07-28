/**
 * Shared helper: Fetch and format company-level AI Knowledge Base documents
 * for injection into all AI prompts.
 *
 * Loads ALL active documents from ai_knowledge_documents.
 * Any document marked active=true will be injected into the assistant's context.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface CompanyKbDocument {
  id: string;
  key: string;
  title: string;
  version: number;
  content_markdown: string;
}

export interface CompanyKbContext {
  documents: CompanyKbDocument[];
  versions: Record<string, number>; // key → version for provenance
}

/**
 * Load ALL active company KB documents.
 * Returns null if none found (non-fatal).
 */
export async function getCompanyKbContext(
  supabase: SupabaseClient,
): Promise<CompanyKbContext | null> {
  try {
    const { data, error } = await supabase
      .from("ai_knowledge_documents")
      .select("id, key, title, version, content_markdown")
      .eq("active", true)
      .order("key");

    if (error || !data || data.length === 0) {
      if (error) console.warn("[company-kb] fetch error:", error.message);
      return null;
    }

    const documents: CompanyKbDocument[] = data;
    const versions: Record<string, number> = {};
    for (const doc of documents) {
      versions[doc.key] = doc.version;
    }

    return { documents, versions };
  } catch (err) {
    console.warn("[company-kb] exception:", err);
    return null;
  }
}

/**
 * Format company KB into a deterministic prompt block.
 * Each active document becomes a labeled section.
 */
export function formatCompanyKbForPrompt(ctx: CompanyKbContext): string {
  return ctx.documents
    .map((doc) => {
      const label = doc.title || doc.key.replace(/_/g, " ").toUpperCase();
      return `=== ${label} (v${doc.version}) ===\n${doc.content_markdown}`;
    })
    .join("\n\n");
}

/**
 * Build the full system prompt injection block for company KB.
 */
export function buildCompanyKbSystemBlock(ctx: CompanyKbContext): string {
  const content = formatCompanyKbForPrompt(ctx);
  if (!content) return "";

  return `
--- AUTHORITATIVE COMPANY KNOWLEDGE BASE ---
The following company information is authoritative. Do not contradict it.
Do not introduce claims about PCs for People that are not present below.

${content}
--- END COMPANY KNOWLEDGE BASE ---`;
}
