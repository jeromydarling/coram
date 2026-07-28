/**
 * altText — Narrative-aware alt text generator.
 *
 * WHAT: Produces descriptive, calm, human-first alt text from narrative context.
 * WHERE: Used by marketing pages, Living Library images, archetype imagery.
 * WHY: Accessibility + SEO without keyword stuffing — every image tells a story.
 */

export interface AltTextContext {
  /** Visual subject — e.g. 'volunteers', 'community gathering', 'neighborhood map'. */
  subject: string;
  /** Optional action — e.g. 'sharing a meal', 'reviewing journey notes'. */
  action?: string;
  /** Optional setting — e.g. 'in a neighborhood center', 'during a parish visit'. */
  setting?: string;
  /** Optional archetype for tone alignment. */
  archetype?: string;
}

/**
 * Generates human-first, descriptive alt text.
 * Never stuffs keywords — reads like a gentle caption.
 */
export function generateAltText(ctx: AltTextContext): string {
  const parts: string[] = [];

  // Subject is always present
  parts.push(ctx.subject);

  // Action adds movement
  if (ctx.action) parts.push(ctx.action);

  // Setting adds place
  if (ctx.setting) parts.push(ctx.setting);

  return parts.join(' ');
}

/**
 * Generates alt text from a section heading + surrounding narrative.
 * Useful when no explicit image context exists.
 */
export function generateAltTextFromNarrative(
  sectionHeading: string,
  narrativeSnippet?: string
): string {
  // Strip markdown
  const clean = sectionHeading.replace(/[#*_]/g, '').trim();

  if (!narrativeSnippet) {
    return `Illustration for ${clean}`;
  }

  // Extract the first meaningful phrase (up to 15 words)
  const words = narrativeSnippet
    .replace(/[#*_<>]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 15)
    .join(' ');

  return `${clean} — ${words}`;
}
