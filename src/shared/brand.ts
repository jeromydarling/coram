/**
 * Brand tokens, contrast maths, and the flyer/share templates.
 *
 * This is workspace configuration, not a twelfth module. §5 lists eleven and is
 * closed; a group's colours and wordmark are settings that several modules
 * read, and the composer that turns them into a flyer is a Nuntius surface
 * (§5.4 — outreach) reading Convocare event data (§5.3).
 *
 * Why contrast is enforced rather than suggested: the people using this are
 * printing flyers at a copy shop and pinning them to a noticeboard in a badly
 * lit corridor. A palette that fails WCAG AA is not a stylistic choice, it is a
 * flyer nobody reads. `assertLegible` refuses to render one, and the studio
 * shows the ratio while you are picking colours rather than after.
 *
 * Nothing here touches personal data. Brand tokens are the least sensitive
 * thing in the product, which is why this file can be pure and fully tested.
 */

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export type Hex = string;

const HEX = /^#?([0-9a-f]{6})$/i;

export function parseHex(value: string): { r: number; g: number; b: number } {
  const match = HEX.exec(value.trim());
  if (!match) throw new BrandError(`Not a six-digit hex colour: ${value}`);
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function normaliseHex(value: string): Hex {
  const { r, g, b } = parseHex(value);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2.1 relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA thresholds. Large is 18pt, or 14pt bold. */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;

export function meetsAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? AA_LARGE : AA_NORMAL);
}

/**
 * The most readable ink for a background, from a candidate list.
 *
 * Used so a group can pick any brand colour they like for a panel and still get
 * type they can read on it, rather than being told their colour is wrong.
 */
export function readableInk(bg: string, candidates: string[] = ['#111111', '#ffffff']): Hex {
  let best = candidates[0];
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, bg);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  return normaliseHex(best);
}

export class BrandError extends Error {}

// ---------------------------------------------------------------------------
// Brand profile
// ---------------------------------------------------------------------------

export interface BrandProfile {
  /** Shown as the wordmark when no logo has been uploaded. */
  name: string;
  /** Primary. Large areas and the headline rule. */
  primary: Hex;
  /** Used sparingly for emphasis. */
  accent: Hex;
  /** Page or panel background. */
  surface: Hex;
  /** Body text. Checked against `surface`. */
  ink: Hex;
  /** R2 key of an uploaded logo, if any. */
  logoKey: string | null;
}

export const DEFAULT_BRAND: BrandProfile = {
  name: 'Your group',
  primary: '#1f5f4f',
  accent: '#d1642a',
  surface: '#fffaf2',
  ink: '#161310',
  logoKey: null,
};

export interface LegibilityIssue {
  pair: string;
  ratio: number;
  required: number;
}

/**
 * Every pairing a flyer will actually put together, checked.
 *
 * Returns issues rather than throwing so the studio can show them live while
 * someone is still choosing. `assertLegible` is the gate at render time.
 */
export function legibilityIssues(brand: BrandProfile): LegibilityIssue[] {
  const checks: Array<[string, string, string, number]> = [
    ['body text on surface', brand.ink, brand.surface, AA_NORMAL],
    // The headline sits on the primary panel at display size, so AA large.
    ['headline on primary', readableInk(brand.primary), brand.primary, AA_LARGE],
    ['accent on surface', brand.accent, brand.surface, AA_LARGE],
  ];

  const issues: LegibilityIssue[] = [];
  for (const [pair, fg, bg, required] of checks) {
    const ratio = contrastRatio(fg, bg);
    if (ratio < required) issues.push({ pair, ratio: Math.round(ratio * 100) / 100, required });
  }
  return issues;
}

export function assertLegible(brand: BrandProfile): void {
  const issues = legibilityIssues(brand);
  if (issues.length) {
    const detail = issues
      .map((i) => `${i.pair} is ${i.ratio}:1, needs ${i.required}:1`)
      .join('; ');
    throw new BrandError(`These colours will not be readable in print: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Flyer templates
// ---------------------------------------------------------------------------

export type TemplateId = 'notice' | 'rally' | 'meeting';

export interface FlyerTemplate {
  id: TemplateId;
  name: string;
  /** What it is for, in the studio's own words. */
  blurb: string;
}

export const TEMPLATES: FlyerTemplate[] = [
  {
    id: 'notice',
    name: 'Notice',
    blurb: 'Quiet and dense. For a noticeboard where people are already standing still.',
  },
  {
    id: 'rally',
    name: 'Rally',
    blurb: 'Big type, one message. Readable from across a street or a corridor.',
  },
  {
    id: 'meeting',
    name: 'Meeting',
    blurb: 'Time, place, and what will be decided. The one people put on a fridge.',
  },
];

/** US Letter at 96dpi. Prints without scaling and doubles as a screen asset. */
export const FLYER_W = 816;
export const FLYER_H = 1056;

export interface FlyerContent {
  headline: string;
  /** Date and time, already formatted by the caller in the group's locale. */
  when: string;
  where: string;
  /** One line. Optional. */
  detail?: string;
  /** Where to go next: a short URL, an address, a phone number. */
  callToAction?: string;
}

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

export interface Channel {
  id: string;
  name: string;
  /** Hard limit for the post body. */
  limit: number;
  /** Whether a link consumes characters from the limit. */
  linkCostsCharacters: boolean;
}

/**
 * Export-first, deliberately.
 *
 * Coram does not hold posting credentials for a group's social accounts. An
 * OAuth token that can post as a tenants' union is a subpoena target and a
 * compromise vector, and §7 forbids auto-posting regardless. So the product
 * produces the image and the words, and a person posts them.
 */
export const CHANNELS: Channel[] = [
  { id: 'mastodon', name: 'Mastodon', limit: 500, linkCostsCharacters: true },
  { id: 'bluesky', name: 'Bluesky', limit: 300, linkCostsCharacters: true },
  { id: 'x', name: 'X', limit: 280, linkCostsCharacters: false },
  { id: 'instagram', name: 'Instagram caption', limit: 2200, linkCostsCharacters: true },
  { id: 'facebook', name: 'Facebook', limit: 63206, linkCostsCharacters: true },
];

/** X shortens every link to a fixed 23 characters regardless of length. */
const X_LINK_COST = 23;

export function postLength(body: string, link: string | undefined, channel: Channel): number {
  if (!link) return body.length;
  if (channel.linkCostsCharacters) return body.length + link.length + 1;
  return body.length + X_LINK_COST + 1;
}

export function fitsChannel(body: string, link: string | undefined, channel: Channel): boolean {
  return postLength(body, link, channel) <= channel.limit;
}

/**
 * Trim a draft to a channel without cutting a word in half.
 *
 * Returns null when even the link does not fit, rather than emitting a stub —
 * a post that has been silently truncated into nonsense is worse than one the
 * studio says it cannot make.
 */
export function fitToChannel(
  body: string,
  link: string | undefined,
  channel: Channel,
): string | null {
  if (fitsChannel(body, link, channel)) return body;

  const overhead = link ? postLength('', link, channel) : 0;
  const room = channel.limit - overhead - 1; // room for the ellipsis
  if (room < 40) return null;

  const cut = body.slice(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > room * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
