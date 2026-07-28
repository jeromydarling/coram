/**
 * lexiconLinker — Auto-linking helper for CROS Lexicon™ terms.
 *
 * WHAT: Scans text for known lexicon terms and returns segments for rendering linked text.
 * WHERE: Used in marketing content components to auto-link terms.
 * WHY: Builds semantic authority by connecting content to lexicon definitions.
 */
import { CROS_LEXICON } from '@/content/lexicon';

interface TextSegment {
  text: string;
  slug?: string;
}

// Build lookup sorted by title length (longest first to avoid partial matches)
const TERM_MAP = CROS_LEXICON
  .flatMap((entry) => {
    const titles = [entry.title];
    // Add short forms for common terms
    if (entry.title.includes('(') && entry.title.includes(')')) {
      const abbr = entry.title.match(/\(([^)]+)\)/)?.[1];
      if (abbr) titles.push(abbr);
    }
    return titles.map((t) => ({ term: t, slug: entry.slug }));
  })
  .sort((a, b) => b.term.length - a.term.length);

/**
 * Parse text into segments, linking known lexicon terms.
 * Each term is linked only on its first occurrence.
 */
export function linkLexiconTerms(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let remaining = text;
  const linked = new Set<string>();

  while (remaining.length > 0) {
    let earliest = -1;
    let matched: (typeof TERM_MAP)[0] | null = null;

    for (const entry of TERM_MAP) {
      if (linked.has(entry.slug)) continue;
      const idx = remaining.indexOf(entry.term);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        matched = entry;
      }
    }

    if (matched && earliest !== -1) {
      if (earliest > 0) {
        segments.push({ text: remaining.slice(0, earliest) });
      }
      segments.push({ text: matched.term, slug: matched.slug });
      linked.add(matched.slug);
      remaining = remaining.slice(earliest + matched.term.length);
    } else {
      segments.push({ text: remaining });
      break;
    }
  }

  return segments;
}
