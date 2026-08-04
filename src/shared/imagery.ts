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

/**
 * A scene may name at most one pair of hands.
 *
 * The same shape of lesson as FACE_CLAUSES, learned the same way and only
 * after it shipped. The shared-table prompt asked for "six pairs of hands ...
 * a hand reaching across to point" — thirteen hands, of the one thing these
 * models are least reliable at — and what came back was a tangle of fingers
 * that does not survive being looked at, on the front page of a site whose
 * argument is that we make things carefully.
 *
 * Two hands is a person at the edge of a still life. Past that, describe the
 * surface, the light and the objects and let their absence be the composition.
 *
 * The first version of this was a counter that tried to total the hands in a
 * sentence. It scored "one pair of hands resting" as three and "no hands here"
 * as one, which is a good argument for a rule simple enough to be obviously
 * correct: look for a quantity word close in front of the word.
 */
export function asksForManyHands(subject: string): boolean {
  return /\b(two|three|four|five|six|seven|eight|nine|ten|dozens?|many|several|multiple|countless|forest)\b[^.]{0,40}?\bhands\b/i.test(
    subject,
  );
}

/** Words that mean "more people than an effect can be trusted to cover". */
const CROWD = /\b(crowd|crowded|packed|dozens|people|callers|everyone|others)\b/i;

/**
 * A room full of people all facing one way, with nothing named at that end.
 *
 * The third distinct way the face rule has bitten, after the chair circle and
 * the blur clauses. Anyone standing at the front addressing a room faces the
 * camera, so the rule silently forbids the one element that would give the shot
 * a subject — and the model obliges by rendering sixty people staring at an
 * empty trestle table. It is not a bad seed and no reroll fixes it: the prompt
 * asked for an audience and no performance.
 *
 * The escape is the one the whiteboard frame found on its own. A person at the
 * front turned toward a surface — an easel, a board, a map — has their back to
 * the room and to the lens at the same time, which satisfies the rule and fills
 * the frame.
 *
 * The first version of this check failed the hero, which was wrong and worth
 * keeping the correction: that frame is a hall mid-vote, a forest of raised
 * hands, and it is one of the best images we have. The fault is never "an
 * audience facing forward" — it is an audience *doing nothing, facing nothing*.
 * A room in the act of voting is its own subject and needs no lectern. So the
 * escape is either something at the far end, or something the people in frame
 * are visibly doing.
 */
const AUDIENCE = /\b(rows of|seated|audience|facing (the )?(front|forward)|all facing)\b/i;
const FOCAL_POINT =
  /\b(easel|whiteboard|flip ?chart|board|lectern|podium|screen|projector|map|banner|speaker|standing at the front)\b/i;
/**
 * The audience is the subject: hands up, hands on something.
 *
 * "leaning together" and "talking in pairs" were in this list and had to come
 * out. They are the chair circle again in different words: people talking to
 * each other are by definition facing each other, so some of them face the lens.
 * The frame came back full of sharp faces, and it came back that way because the
 * prompt asked for it — the escape hatch I added to fix one failure quietly
 * licensed another.
 *
 * What survives here is action that points every body the same way. A raised
 * hand does not turn a head around; a conversation does.
 */
const OWN_ACTION = /\b(raised hands|hands raised|mid-vote|voting|passing|signing|reaching up)\b/i;

/** Framings that seat people face to face, which the face rule cannot survive. */
const FACE_TO_FACE = /\b(leaning together|talking in pairs|facing each other|in conversation|around a circle|circle of)\b/i;

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
  /**
   * Opt out of the one-pair-of-hands rule, with the reason written inline.
   *
   * There is exactly one scene where a crowd of hands is the subject and the
   * risk does not apply, and it has to say so rather than the rule quietly
   * making an allowance for it.
   */
  manyHandsOk?: true;
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
    /*
     * The one scene where a crowd of hands is the point rather than a hazard.
     *
     * Every hand here is thirty feet from the lens in a 1920-wide frame, so no
     * one of them is more than a few dozen pixels — the scale at which the
     * model's difficulty with fingers stops being visible. The shared-table
     * failure was hands at arm's length filling half the frame. Distance is
     * what makes the difference, and it is why this is an exemption with a
     * reason rather than a hole in the rule.
     */
    manyHandsOk: true,
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
    /*
     * The table, not the hands over it.
     *
     * This asked for "six pairs of hands ... a hand reaching across to point",
     * which is a request for thirteen hands — and hands are the single thing
     * these models are worst at. What came back was a tangle of fingers that
     * does not survive being looked at, on a page whose argument is that we
     * make things carefully. See HAND_LIMIT below.
     *
     * The meaning does not need them. "One table, one set of papers, and no
     * argument about who is on the list" is a still life: the shared surface
     * after everyone has leaned over it. One pair of hands at the edge keeps it
     * from reading as an empty room.
     */
    subject:
      'a long table photographed from above at a slight angle, covered in butcher paper marked ' +
      'up in coloured pen, sticky notes in pink and yellow and green, a scatter of markers with ' +
      'their caps off, two mugs and a plate of food pushed to the edge, one pair of hands ' +
      'resting at the near corner, low sunlight raking across the paper',
    faceClause: 'framed below the shoulders, no faces in frame',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A long table seen from above, covered in marked-up paper, sticky notes and markers, with low sunlight across it.',
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
    /*
     * There is somebody at the front, and there has to be.
     *
     * The first version described a hall of people facing forward and nothing
     * else. It came back exactly as written: sixty people staring at a trestle
     * table of coffee urns and three empty chairs, which reads as a room
     * waiting for a speaker who never arrived. That is the face rule biting —
     * anyone standing at the front addressing the room faces the camera, so
     * the rule quietly forbids the only thing that would fill the focal point.
     *
     * The way out is the one the whiteboard frame already found: put the person
     * at the front turned toward a surface. Writing on an easel, they have
     * their back to the room and to the lens at once, the rule holds, and the
     * audience is looking at something.
     */
    subject:
      'a bright union hall during a meeting, photographed from the back of the room low over the ' +
      'backs of seated heads and shoulders which fill the lower half of the frame, one person ' +
      'standing at the front writing on a large paper easel pad with their back to the room, ' +
      'the seated rows squarely between the camera and the easel and none of them turned to the ' +
      'side, warm afternoon light through tall windows, colourful jackets over chair backs',
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
      /*
       * From directly behind the row, not along it. "Looking down the line"
       * points the lens across every head in profile, and profiles are faces —
       * the version shot that way came back with several. Standing behind the
       * callers and shooting past them at the wall gives backs of heads and
       * puts the colour where it belongs, on the sticky notes ahead.
       */
      'a phone bank along a table in a sunlit room, photographed from directly behind the row ' +
      'of callers over their shoulders, backs of heads and headset bands in the foreground, ' +
      'the far wall ahead of them covered in bright sticky notes and a hand-drawn tally in ' +
      'colour, low sun across the wall',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    alt: 'A phone bank photographed from behind the callers, colourful tally sheets ahead of them.',
  },
  {
    id: 'coffee-urn',
    /*
     * A low camera locked to the table. "Framed below the shoulders" describes
     * what should be absent, and the model simply widened the shot until two
     * faces were in it. Describing where the camera sits — table height, frame
     * filled by the tabletop — constrains the crop instead of asking for a
     * subtraction.
     */
    subject:
      'a low camera at table height during a food and drink rush, the frame filled edge to edge ' +
      'by the tabletop, hands and forearms reaching in from every side, a steel urn, bright ' +
      'stacked cups in pink and green, trays of fruit and bread, steam in a shaft of sunlight',
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
    /*
     * Rows, not a circle. A circle of chairs seats people facing inward from
     * every side, so some of them necessarily face the lens — the concept and
     * the face rule are geometrically incompatible, and the frame came back
     * with a sharp profile at the left edge. Rows all facing the same bright
     * doorway keep the "people arriving" feeling and point every head away.
     */
    /*
     * A detail, not a second crowd scene. union-hall already carries the full
     * room, and the version of this that put people in conversation came back
     * full of faces — see FACE_TO_FACE above. Bringing the camera down to the
     * chairs keeps the colour and the sense of a room filling up, and there is
     * almost nobody in frame to point the wrong way.
     */
    subject:
      'a low close view along a row of mismatched folding chairs in a sunlit community room, ' +
      'bright coats and bags in orange and yellow and teal slung over the chair backs filling ' +
      'the foreground, a few people further down the row seen from behind settling into seats ' +
      'and facing away toward a doorway flooded with light',
    faceClause: 'seen entirely from behind, no faces visible',
    accent: true,
    width: 1600,
    height: 1000,
    widths: WIDE,
    // Was "A circle of folding chairs" — left behind when the circle became
    // rows, so the alt text described a photograph that no longer existed.
    // Alt text is the only version of this image a screen reader ever gets.
    alt: 'A row of folding chairs draped with bright coats in a sunlit community room.',
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

  if (!spec.manyHandsOk && asksForManyHands(spec.subject)) {
    throw new DirectionError(
      `${spec.id}: a prompt that asks for a quantity of hands gets a tangle of fingers back — ` +
        `hands are what these models are worst at. Name at most one pair, or describe the ` +
        `surface and the light instead. Set manyHandsOk with a reason if the hands are far ` +
        `enough from the lens for it not to matter.`,
    );
  }

  if (FACE_TO_FACE.test(spec.subject)) {
    throw new DirectionError(
      `${spec.id}: people described as facing each other will face the camera too — this is the ` +
        `chair circle again. Point everyone the same way and give them something at the far end.`,
    );
  }

  if (
    AUDIENCE.test(spec.subject) &&
    !FOCAL_POINT.test(spec.subject) &&
    !OWN_ACTION.test(spec.subject)
  ) {
    throw new DirectionError(
      `${spec.id}: this seats an audience but names nothing for them to be looking at, so the ` +
        `frame will come back as a room staring at empty space. The face rule forbids a speaker ` +
        `facing the room, so put someone at the front turned toward a surface — an easel or a ` +
        `board — or give the people in frame each other to attend to.`,
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
