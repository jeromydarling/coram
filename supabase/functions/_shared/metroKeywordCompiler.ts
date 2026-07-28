/**
 * Metro Keyword Compiler — Phase 5B
 *
 * Compiles metro-specific + global default keywords into a deduplicated,
 * weight-sorted list, then generates search query bundles for news discovery.
 */

interface CompiledKeyword {
  keyword: string;
  category: string;
  weight: number;
  match_mode: "phrase" | "any" | "all";
}

interface KeywordSettings {
  use_global_defaults: boolean;
  max_keywords: number;
  radius_miles: number;
}

export interface CompileResult {
  keywords: CompiledKeyword[];
  settings: KeywordSettings;
}

const DEFAULT_SETTINGS: KeywordSettings = {
  use_global_defaults: true,
  max_keywords: 40,
  radius_miles: 50,
};

/**
 * Compile keywords for a metro: fetch metro overrides, merge with globals,
 * deduplicate (metro wins), sort by weight desc, cap at max_keywords.
 */
export async function compileMetroKeywords(
  sb: { from: (table: string) => any },
  metroId: string,
): Promise<CompileResult> {
  // 1. Fetch settings (or use defaults)
  const { data: settingsRow } = await sb
    .from("metro_news_keyword_sets")
    .select("use_global_defaults, max_keywords, radius_miles")
    .eq("metro_id", metroId)
    .maybeSingle();

  const settings: KeywordSettings = settingsRow
    ? {
        use_global_defaults: settingsRow.use_global_defaults ?? true,
        max_keywords: settingsRow.max_keywords ?? 40,
        radius_miles: settingsRow.radius_miles ?? 50,
      }
    : { ...DEFAULT_SETTINGS };

  // 2. Fetch metro-specific keywords (enabled only)
  const { data: metroKws } = await sb
    .from("metro_news_keywords")
    .select("keyword, category, weight, match_mode")
    .eq("metro_id", metroId)
    .eq("enabled", true);

  const metroKeywords: CompiledKeyword[] = (metroKws ?? []).map((k: any) => ({
    keyword: k.keyword,
    category: k.category,
    weight: k.weight,
    match_mode: k.match_mode,
  }));

  // 3. Merge globals if enabled
  let merged: CompiledKeyword[] = [...metroKeywords];
  const metroKeywordSet = new Set(metroKeywords.map((k) => k.keyword.toLowerCase()));

  if (settings.use_global_defaults) {
    const { data: globalKws } = await sb
      .from("global_news_keywords")
      .select("keyword, category, weight, match_mode")
      .eq("enabled", true);

    for (const g of globalKws ?? []) {
      // Metro-specific overrides win by keyword
      if (!metroKeywordSet.has(g.keyword.toLowerCase())) {
        merged.push({
          keyword: g.keyword,
          category: g.category,
          weight: g.weight,
          match_mode: g.match_mode,
        });
      }
    }
  }

  // 4. Sort by weight desc (stable sort by category as tiebreaker)
  merged.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.category.localeCompare(b.category);
  });

  // 5. Cap at max_keywords
  merged = merged.slice(0, settings.max_keywords);

  return { keywords: merged, settings };
}

// ── Query Bundle Generation ──

interface QueryBundle {
  label: string;
  query: string;
  categories: string[];
  keywords_used: string[];
}

/**
 * Build search query bundles from compiled keywords.
 * Produces 6-10 queries max, each combining the metro geo terms
 * with 2-5 categorized keywords.
 */
export function buildNewsSearchQueries(
  metroName: string,
  compiledKeywords: CompiledKeyword[],
): QueryBundle[] {
  // Build metro geo clause
  const geoTerms = buildGeoTerms(metroName);
  const geoClause = geoTerms.map((t) => `"${t}"`).join(" OR ");

  // Group keywords by category
  const byCategory = new Map<string, CompiledKeyword[]>();
  for (const kw of compiledKeywords) {
    const existing = byCategory.get(kw.category) ?? [];
    existing.push(kw);
    byCategory.set(kw.category, existing);
  }

  const bundles: QueryBundle[] = [];

  // Query allocation: category -> max queries
  const allocation: Array<{ category: string; maxQueries: number; kwsPerQuery: number }> = [
    { category: "need_signals", maxQueries: 3, kwsPerQuery: 3 },
    { category: "partner_signals", maxQueries: 2, kwsPerQuery: 3 },
    { category: "policy", maxQueries: 1, kwsPerQuery: 3 },
    { category: "local_events", maxQueries: 2, kwsPerQuery: 3 },
    { category: "education", maxQueries: 1, kwsPerQuery: 4 },
    { category: "workforce", maxQueries: 1, kwsPerQuery: 4 },
  ];

  for (const alloc of allocation) {
    const categoryKws = byCategory.get(alloc.category) ?? [];
    if (categoryKws.length === 0) continue;

    // Chunk keywords into groups
    const chunks = chunkArray(categoryKws, alloc.kwsPerQuery);
    for (const chunk of chunks.slice(0, alloc.maxQueries)) {
      const kwClause = chunk
        .map((kw) => formatKeyword(kw))
        .join(" OR ");

      bundles.push({
        label: `${alloc.category}_${bundles.length + 1}`,
        query: `(${geoClause}) AND (${kwClause})`,
        categories: [alloc.category],
        keywords_used: chunk.map((k) => k.keyword),
      });
    }
  }

  // Mixed education+workforce if we haven't generated enough
  if (bundles.length < 6) {
    const eduKws = byCategory.get("education") ?? [];
    const wkfKws = byCategory.get("workforce") ?? [];
    const mixed = [...eduKws.slice(0, 2), ...wkfKws.slice(0, 2)];
    if (mixed.length > 0) {
      const kwClause = mixed.map((kw) => formatKeyword(kw)).join(" OR ");
      bundles.push({
        label: `edu_workforce_mix`,
        query: `(${geoClause}) AND (${kwClause})`,
        categories: ["education", "workforce"],
        keywords_used: mixed.map((k) => k.keyword),
      });
    }
  }

  // Health services fallback
  const healthKws = byCategory.get("health_services") ?? [];
  if (healthKws.length > 0 && bundles.length < 10) {
    const chunk = healthKws.slice(0, 4);
    const kwClause = chunk.map((kw) => formatKeyword(kw)).join(" OR ");
    bundles.push({
      label: `health_services`,
      query: `(${geoClause}) AND (${kwClause})`,
      categories: ["health_services"],
      keywords_used: chunk.map((k) => k.keyword),
    });
  }

  return bundles.slice(0, 10);
}

// ── Helpers ──

function buildGeoTerms(metroName: string): string[] {
  const terms = [metroName];
  // Handle compound metros like "Minneapolis-St. Paul"
  if (metroName.includes("-")) {
    terms.push(...metroName.split("-").map((t) => t.trim()));
  }
  // Handle "St." abbreviation
  for (const term of [...terms]) {
    if (term.includes("St.")) {
      terms.push(term.replace("St.", "Saint"));
    }
  }
  return [...new Set(terms)];
}

function formatKeyword(kw: CompiledKeyword): string {
  switch (kw.match_mode) {
    case "phrase":
      return `"${kw.keyword}"`;
    case "all":
      return kw.keyword
        .split(/\s+/)
        .map((w) => w)
        .join(" AND ");
    case "any":
    default:
      return kw.keyword;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
