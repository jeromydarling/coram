/**
 * Art direction for the marketing site (§8.2).
 *
 * The direction is data rather than prose so that the rules are checkable.
 * §8.2 says of the face rule: "This is a rule, not a preference." A rule that
 * only exists in a document gets broken the first time someone generates a
 * nice-looking frame at 1am, so `assertOnDirection()` enforces it and
 * `imagery.test.ts` runs it over every prompt in this file.
 *
 * On the ban list: it is a lint over our own prompts, and it is deliberately
 * NOT sent to the model. Flux is guidance-distilled, and telling it "no
 * megaphones" reliably puts a megaphone in frame — naming a thing is how you
 * summon it. So we describe only what is present, and we check ourselves.
 *
 * Why any of this matters beyond taste: §8.2's face rule makes the visual
 * language demonstrate the privacy posture. A site that promises not to
 * surveil organizers, illustrated with crisp identifiable faces of organizers,
 * argues against itself before anyone reads a word.
 */

/** 35mm, available light, muted. Prepended to every prompt. */
export const STYLE =
  'documentary photojournalism, 35mm film photograph, Kodak Portra 400, available light only, ' +
  'natural film grain, shallow depth of field, muted desaturated color palette, low contrast, ' +
  'candid and unposed, no one aware of the camera';

/**
 * §8.2 allows one warm accent, "amber, sparingly". Sparingly is enforced by
 * `MAX_ACCENT_SHARE` below rather than left to judgement.
 */
export const ACCENT = 'a single warm amber light source just out of frame';

/** At most this share of the set may use the amber accent. §8.2: "sparingly". */
export const MAX_ACCENT_SHARE = 0.4;

/**
 * Every image obscures faces. One of these clauses must appear in every
 * prompt — they are the four ways §8.2 permits.
 */
export const FACE_CLAUSES = [
  'seen entirely from behind, no faces visible',
  'faces fully out of focus and unrecognizable',
  'framed below the shoulders, no faces in frame',
  'backlit into silhouette, features not discernible',
] as const;

/**
 * §8.2's "Never" list. Checked against our prompts, never sent to the model.
 * Written as word-boundary patterns so "flagship" does not trip "flag".
 */
export const BANNED = [
  /\braised fists?\b/i,
  /\briots?\b/i,
  /\btear gas\b/i,
  /\bflags?\b/i,
  /\bmegaphones?\b/i,
  /\bbullhorns?\b/i,
  /\bprotest signs?\b/i,
  /\bplacards?\b/i,
  /\bpicket signs?\b/i,
  /\bsmiling at the camera\b/i,
  /\bdiverse group posing\b/i,
  /\bstock photo\b/i,
  /\bglowing code\b/i,
  /\bserver rack\b/i,
] as const;

export type ImageId =
  | 'hero-hall'
  | 'why-portrait'
  | 'shared-table'
  | 'sign-in-sheet'
  | 'union-hall'
  | 'phone-bank'
  | 'coffee-urn'
  | 'whiteboard'
  | 'folding-chairs';

export interface ImageSpec {
  id: ImageId;
  /** The scene. Style, accent and face clause are composed in by `prompt()`. */
  subject: string;
  faceClause: (typeof FACE_CLAUSES)[number];
  accent: boolean;
  width: number;
  height: number;
  /** Responsive widths emitted by the build. Descending. */
  widths: number[];
  /** Real alt text. Describes the photograph, not the marketing point. */
  alt: string;
}

const WIDE = [1920, 1440, 1024, 640];
const TALL = [1200, 900, 640];

export const IMAGES: ImageSpec[] = [
  {
    id: 'hero-hall',
    subject:
      'a crowded community meeting hall at night, forty people on folding chairs facing away ' +
      'toward a speaker, coats still on, low ceiling, fluorescent tubes overhead, worn linoleum, ' +
      'a stack of unused chairs against the back wall',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1920,
    height: 1080,
    widths: WIDE,
    alt: 'A packed evening meeting in a low-ceilinged hall, photographed from the back of the room.',
  },
  {
    id: 'why-portrait',
    subject:
      'one person standing at the edge of an emptying meeting room after the meeting has ended, ' +
      'holding a clipboard against their chest, stacked chairs behind them, late evening light ' +
      'through a high window',
    faceClause: 'backlit into silhouette, features not discernible',
    accent: true,
    width: 1200,
    height: 1600,
    widths: TALL,
    alt: 'A lone figure with a clipboard in a room being packed up after a meeting.',
  },
  {
    id: 'shared-table',
    subject:
      'four pairs of hands on a shared folding table covered in paper, a spiral notebook, ' +
      'a chipped mug, a pen mid-sentence, overlapping documents',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: false,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'Hands and paperwork on a shared folding table.',
  },
  {
    id: 'sign-in-sheet',
    subject:
      'a printed sign-in sheet on a clipboard at the edge of a table, ruled columns filled in ' +
      'with unreadable handwriting, a pen resting on top, a roll of blank name tags beside it',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: false,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A paper sign-in sheet on a clipboard, handwriting illegible.',
  },
  {
    id: 'union-hall',
    subject:
      'the interior of an old union hall in the afternoon, empty rows of wooden chairs, ' +
      'a scuffed wooden floor, high windows, a long table at the front with a water pitcher',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: false,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'An empty union hall in the afternoon, chairs in rows.',
  },
  {
    id: 'phone-bank',
    subject:
      'a phone bank set up along a folding table in a borrowed room, people leaning over ' +
      'handwritten call lists, headsets, a hand-drawn tally chart taped to the wall behind them',
    faceClause: 'faces fully out of focus and unrecognizable',
    accent: false,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'Volunteers working a phone bank at a folding table with paper call lists.',
  },
  {
    id: 'coffee-urn',
    subject:
      'a large steel coffee urn on a side table with stacked paper cups, a box of sugar packets, ' +
      'a hand reaching in from the edge of the frame, condensation on the metal',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A steel coffee urn and stacked paper cups on a side table.',
  },
  {
    id: 'whiteboard',
    subject:
      'a whiteboard covered in overlapping handwriting mid-argument, arrows between boxes, ' +
      'three items circled, half-erased text underneath, two people standing at the edge of ' +
      'the frame pointing at different parts of it',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: false,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A whiteboard dense with overlapping handwriting and arrows.',
  },
  {
    id: 'folding-chairs',
    subject:
      'rows of empty folding chairs in a basement community room before anyone arrives, ' +
      'a plain wall with the marks where things used to hang, a radiator, a single lit lamp',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: false,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'Empty folding chairs in a basement room before a meeting.',
  },
];

/** The full text sent to Flux. */
export function prompt(spec: ImageSpec): string {
  return [STYLE, spec.subject, spec.faceClause, spec.accent ? ACCENT : null]
    .filter(Boolean)
    .join(', ');
}

export class DirectionError extends Error {}

/**
 * Fails a prompt that breaks §8.2. Called by the generator before it spends a
 * single inference, and by the test suite over the whole set.
 */
export function assertOnDirection(spec: ImageSpec): void {
  const text = prompt(spec);

  for (const pattern of BANNED) {
    if (pattern.test(text)) {
      throw new DirectionError(
        `${spec.id}: §8.2 bans this subject — prompt matches ${pattern}`,
      );
    }
  }

  if (!FACE_CLAUSES.some((clause) => text.includes(clause))) {
    throw new DirectionError(
      `${spec.id}: §8.2 requires every image to obscure faces, and this prompt does not say how.`,
    );
  }

  // Alt text that repeats the marketing claim is not alt text. It should
  // describe the photograph to someone who cannot see it.
  if (!spec.alt.trim() || spec.alt.length < 20) {
    throw new DirectionError(`${spec.id}: alt text is missing or too short to be useful.`);
  }
}

export function byId(id: ImageId): ImageSpec {
  const spec = IMAGES.find((i) => i.id === id);
  if (!spec) throw new Error(`No image spec: ${id}`);
  return spec;
}

/** `media/hero-hall-1440.avif` — the key in R2 and the path under /media. */
export function objectKey(id: ImageId, width: number, format: 'avif' | 'webp' | 'jpeg'): string {
  return `${id}-${width}.${format === 'jpeg' ? 'jpg' : format}`;
}
