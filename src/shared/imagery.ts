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

/**
 * 35mm, available light, muted. Prepended to every prompt.
 *
 * No brand names, and that is not pedantry. This preamble originally named a
 * film stock, and the model printed it onto the subject — the sign-in sheet
 * came back with "Kodak Portra 400" as its header. Any prompt token can end up
 * rendered as text when the scene contains a surface that holds text, which
 * here is half the shot list: sign-in sheets, whiteboards, call lists, name
 * tags. Describing the stock instead of naming it gets the same look with
 * nothing for the model to letter onto a page.
 */
export const STYLE =
  'vivid documentary color photograph, 35mm, bright natural daylight flooding the room, ' +
  'rich saturated colour, warm golden hour light, high energy, people in motion, ' +
  'motion blur on moving hands and bodies, shallow depth of field, fine grain, ' +
  'candid and unposed, no one aware of the camera, ' +
  // Applies to everyone in frame, not only the named subject. The /why frame
  // was written for a single figure and the model populated the hall behind
  // them with a cheering crowd, one of whom came back as a sharp profile.
  // A prompt-level check cannot catch people the prompt never asked for, so
  // the instruction has to cover the whole frame.
  'every person in the frame is turned away from the camera';

/**
 * Colour is now the point rather than the exception.
 *
 * §8.2 as written asks for a muted desaturated palette with one amber accent
 * used sparingly. Followed literally it produced nine photographs of dim empty
 * rooms, which read as melancholy — the opposite of what a page about people
 * turning up together should feel like. The restraint is dropped deliberately;
 * the face rule below is not, because that one is an argument the product
 * makes rather than a mood it sets.
 */
export const ACCENT =
  'bold saturated colour in clothing and objects, sunlight breaking across the frame';

/** Most of the set now carries the colour treatment, not a minority of it. */
export const MAX_ACCENT_SHARE = 1;

/**
 * Every image obscures faces. One of these clauses must appear in every
 * prompt — they are the four ways §8.2 permits.
 *
 * They are not equally reliable, and the ordering here is deliberate.
 * `out of focus` is the weakest and should only be used where a single
 * subject sits at a single depth: in a scene with people at several
 * distances the model happily defocuses the foreground and leaves someone
 * mid-frame perfectly sharp. The first phone-bank generation came back with
 * two fully recognizable faces for exactly that reason. Prefer a camera
 * position that makes faces impossible — from behind, or below the
 * shoulders — over a depth-of-field effect that has to land on every person
 * to work.
 */
export const FACE_CLAUSES = [
  'seen entirely from behind, no faces visible',
  'framed below the shoulders, no faces in frame',
  'backlit into silhouette, features not discernible',
  'faces blurred by motion, features not discernible',
  'faces fully out of focus and unrecognizable',
] as const;

/**
 * Clauses that describe an *effect* rather than a camera position.
 *
 * Both have now failed the same way. Depth of field left two callers sharp in
 * a phone bank; motion blur left a dozen faces sharp in the middle of a
 * crowd. An effect only lands on the subjects it happens to land on, and in a
 * scene with people at several depths or several speeds, some of them will be
 * still and in focus.
 *
 * They stay available for a single subject at a single depth, where there is
 * nobody for the effect to miss. `assertOnDirection` refuses them for a crowd.
 */
export const EFFECT_CLAUSES = new Set<string>([
  'faces blurred by motion, features not discernible',
  'faces fully out of focus and unrecognizable',
]);

/** Words that mean "more people than an effect can be trusted to cover". */
const CROWD = /\b(crowd|crowded|packed|dozens|people|callers|everyone|others)\b/i;

/**
 * §8.2's "Never" list. Checked against our prompts, never sent to the model.
 * Written as word-boundary patterns so "flagship" does not trip "flag".
 */
export const BANNED = [
  /\braised fists?\b/i,
  /* Naming three primary colours produced a hall full of matching t-shirts —
     a school assembly rather than a meeting, and the uniformity read as
     exactly the stock-photo grammar §8.2 bans. Describe varied everyday
     clothing instead of specifying a palette for it. */
  /\bmatching (shirts|t-shirts|uniforms)\b/i,
  /\bred and yellow and blue shirts\b/i,
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
    /*
     * Shot from the back of the room, over the crowd, toward the windows. The
     * first colour version framed it from the front with motion blur meant to
     * cover the faces; it covered the moving foreground and left a dozen
     * people in the middle sharp enough to recognise. Standing behind the room
     * makes the rule geometric instead of hoping an effect reaches everyone.
     */
    subject:
      'a packed community hall mid-vote on a bright afternoon, photographed from the back of ' +
      'the room over the heads of the crowd, a forest of raised hands and rows of the backs of ' +
      'heads, the whole room facing one way toward a speaker at the far end beneath tall ' +
      'windows with sun pouring through, ordinary mismatched everyday clothes in many ' +
      'different colours — work jackets, hoodies, cardigans, a headscarf, a hi-vis vest',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1920,
    height: 1080,
    widths: WIDE,
    alt: 'A crowded hall mid-meeting in bright afternoon light, people standing and talking.',
  },
  {
    id: 'why-portrait',
    subject:
      'a single figure alone in an empty sunlit hall carrying a tall stack of folding chairs, ' +
      'seen from behind mid-stride, bright teal jacket, a long shadow thrown across a wooden ' +
      'floor, low sun flaring through high windows, nobody else in the hall',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1200,
    height: 1600,
    widths: TALL,
    alt: 'A person carrying folding chairs mid-stride across a sunlit hall.',
  },
  {
    id: 'shared-table',
    subject:
      'six pairs of hands over a table covered in bright paper, coloured markers, sticky notes ' +
      'in pink and yellow and green, a hand reaching across to point, mugs and a plate of food ' +
      'pushed to the edge, strong sunlight across the table',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'Many hands over a table of coloured paper, markers and sticky notes in strong sunlight.',
  },
  {
    id: 'sign-in-sheet',
    subject:
      'a close crop of a welcome table by a doorway, a clipboard with loose illegible ' +
      'handwriting, a roll of blank name tags, a jar of coloured pens, a bowl of fruit, ' +
      'sunlight and a blurred stream of people arriving behind it',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A welcome table with a clipboard, name tags and coloured pens as people arrive.',
  },
  {
    id: 'union-hall',
    subject:
      'a bright union hall filling up before a meeting, photographed from behind a row of ' +
      'people carrying chairs toward the front, backs of heads and shoulders, warm afternoon ' +
      'light through tall windows, a long table with urns and stacked cups, colourful jackets ' +
      'over chair backs',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A union hall filling up before a meeting, people carrying chairs in warm light.',
  },
  {
    id: 'phone-bank',
    subject:
      'a phone bank along a table in a sunlit room, photographed from behind the row of callers ' +
      'looking down the line, the backs of their heads and headset bands, bright sticky notes ' +
      'and a hand-drawn tally in colour on the wall ahead of them',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A phone bank photographed from behind the callers, colourful tally sheets ahead of them.',
  },
  {
    id: 'coffee-urn',
    subject:
      'a food and drink table mid-rush, hands reaching in from several directions, a steel urn, ' +
      'bright stacked cups, trays of fruit and bread, steam in a shaft of sunlight',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'Hands reaching across a food and drink table lit by a shaft of sunlight.',
  },
  {
    id: 'whiteboard',
    subject:
      'a whiteboard covered in overlapping illegible handwriting in red green and blue marker, ' +
      'loose shorthand scrawled too fast to read, arrows between boxes, three items circled, ' +
      'two people at the edge of the frame reaching up to write at the same time',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A whiteboard dense with coloured handwriting and arrows, two people writing at once.',
  },
  {
    id: 'folding-chairs',
    subject:
      'a wide circle of mismatched folding chairs in a sunlit community room seen from just ' +
      'behind one row, the backs of people settling into seats, bags and coats over chair ' +
      'backs in bright colours, a doorway full of light with more arriving through it',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A circle of folding chairs in a sunlit room as people arrive and sit down.',
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

  if (EFFECT_CLAUSES.has(spec.faceClause) && CROWD.test(spec.subject)) {
    throw new DirectionError(
      `${spec.id}: "${spec.faceClause}" is an effect, and this scene has a crowd in it. ` +
        `Blur and shallow focus both leave some faces sharp — use a camera position instead.`,
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
