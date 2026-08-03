/**
 * Product screenshots for the marketing site.
 *
 * Separate from imagery.ts on purpose. That file governs AI-generated
 * photography and carries rules that only make sense for photographs — a face
 * clause, an accent budget, a banned-subject list, and a test that refuses any
 * spec that wanders off the §8.2 direction. A screenshot has no prompt and no
 * faces; folding it into that registry would mean either weakening those
 * assertions or writing exemptions into them, and both make the photography
 * rules easier to break by accident later.
 *
 * ---------------------------------------------------------------------------
 * Every shot comes from the demo workspace, and that is a hard rule
 * ---------------------------------------------------------------------------
 *
 * The Eastside Tenants Union does not exist. Every name in these pictures is
 * generated from a fixed word list, every address is a street that is not real,
 * and every email is at example.org.
 *
 * The alternative — a screenshot of a real group's workspace — would put actual
 * organizers' names on a public marketing page to sell a product whose entire
 * argument is that we hold as little about them as possible. It is the single
 * most embarrassing thing this site could do, and it is one careless capture
 * away, so shots.test.ts asserts every route below is under /app and the
 * capture script signs in as nobody but the demo account.
 *
 * ---------------------------------------------------------------------------
 * Chromeless
 * ---------------------------------------------------------------------------
 *
 * No browser frame, no fake URL bar, no floating laptop. A drawn window around
 * a screenshot is decoration that adds nothing and dates immediately — the
 * product is the picture. They are shown on the page in a plain rounded
 * container with a hairline, which is also what the app's own `.paper` is.
 */

export type ShotId =
  | 'shot-overview'
  | 'shot-advocacy'
  | 'shot-studio'
  | 'shot-relationships'
  | 'shot-money'
  | 'shot-safety'
  | 'shot-mobile';

export interface ShotSpec {
  id: ShotId;
  /** Route under the deployed app. Must begin /app — see shots.test.ts. */
  route: string;
  /** Capture viewport. The screenshot is the viewport, so this is the crop. */
  viewport: { width: number; height: number };
  /** Responsive widths emitted by the build. Descending. */
  widths: number[];
  /**
   * Something on the page that must be present before the shutter.
   *
   * A screenshot taken mid-load is a picture of skeletons, and it looks
   * plausible enough in a thumbnail that nobody notices until it is on the
   * front page. Every shot names a string that only appears once the data has
   * arrived.
   */
  settled: string;
  /** Real alt text. Describes what is on screen, not the marketing point. */
  alt: string;
  /** The line printed under it. One sentence, no exclamation points. */
  caption: string;
  /**
   * A named interaction to run before the shutter.
   *
   * Most screens are worth photographing as they load. The studio is not: it
   * opens as an empty form beside an empty preview, which is the least
   * flattering possible picture of the one feature that is entirely about how
   * things look. The recipes live in scripts/capture-shots.ts — a name here
   * rather than a function, because this file is imported by the Worker for the
   * media allow-list and must not drag Playwright in with it.
   */
  prepare?: 'studio-compose' | 'advocacy-open';
}

/** Desktop shots share a viewport so the set looks like one product, not seven. */
const DESK = { width: 1280, height: 860 };
const DESK_W = [1280, 960, 640];

export const SHOTS: ShotSpec[] = [
  {
    id: 'shot-overview',
    route: '/app/',
    viewport: DESK,
    widths: DESK_W,
    settled: 'Follow-ups owed',
    alt: 'The Coram overview: counts for people, events, mutual aid raised and follow-ups owed, then the next event and the conversations somebody owes.',
    caption:
      'What is happening, in the order somebody actually asks. Eleven modules down the side, all of them on the free tier.',
  },
  {
    id: 'shot-advocacy',
    route: '/app/advocacy',
    viewport: DESK,
    widths: DESK_W,
    // The list is one card and photographs as an empty screen; the caption
    // promises drafted sections and a route, so the picture has to show them.
    prepare: 'advocacy-open',
    settled: 'Short title',
    alt: 'A draft ordinance open in Coram, showing its short title, enacting clause and definitions as numbered sections, with a note that the draft is structurally complete.',
    caption:
      'Write the law you want. Coram lays out the sections a bill needs, fills in what your state prescribes, and tells you which route actually exists where you live.',
  },
  {
    id: 'shot-studio',
    route: '/app/studio',
    viewport: DESK,
    widths: DESK_W,
    prepare: 'studio-compose',
    // After the compose, not before — 'Studio' is the heading and matches
    // instantly, which is how the first capture came back as an empty form.
    settled: 'Preview',
    alt: 'The design studio: a headline, date and place on the left, and a composed flyer previewed on the right in the group’s own colours.',
    caption:
      'A flyer for a pole or a card for a feed, in your colours. We make the file; you post it — Coram holds no account of yours.',
  },
  {
    id: 'shot-relationships',
    route: '/app/relationships',
    viewport: { width: 1280, height: 800 },
    widths: DESK_W,
    settled: 'Open follow-ups',
    alt: 'The follow-up queue, showing conversations that are owed, one of them snoozed four times.',
    caption:
      'The queue an organizer lives in. It shows you what has been snoozed four times, because that is not a queue any more.',
  },
  {
    id: 'shot-money',
    route: '/app/money',
    viewport: { width: 1280, height: 700 },
    widths: DESK_W,
    settled: 'no platform take',
    alt: 'A mutual aid fund at $3,184 of a $5,000 goal, marked as taking no platform fee, above a disbursement waiting for a second approval.',
    caption:
      'Bail and mutual aid pay us nothing. Not a reduced rate — nothing, and there is no setting that changes it.',
  },
  {
    id: 'shot-safety',
    route: '/app/safety',
    viewport: { width: 1280, height: 560 },
    widths: DESK_W,
    settled: 'legal role only',
    alt: 'The safety screen explaining that jail support is visible to the legal role only, with a note that closed cases are deleted after thirty days.',
    caption:
      'A boundary, explained rather than hidden. Jail support is the legal role and nobody else — not even the person paying for the workspace.',
  },
  {
    id: 'shot-mobile',
    route: '/app/events',
    // A Pixel 7. Organizers use this in a hallway, between doors.
    viewport: { width: 412, height: 780 },
    widths: [412, 320],
    settled: 'going',
    alt: 'The events list on a phone, showing a rent board hearing with the number of people going and how many places are left.',
    caption: 'In a hallway, between doors, on the phone somebody already has.',
  },
];

export const shotById = (id: ShotId): ShotSpec => {
  const shot = SHOTS.find((s) => s.id === id);
  if (!shot) throw new Error(`No shot spec: ${id}`);
  return shot;
};

/** `shot-overview-960.avif` — the key in R2 and the path under /media. */
export const shotKey = (id: ShotId, width: number, format: 'avif' | 'webp' | 'png'): string =>
  `${id}-${width}.${format}`;
