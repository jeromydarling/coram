/**
 * The eleven, as data.
 *
 * §5 is a closed list — eleven modules, no twelfth, none dropped. Keeping that
 * list in one array rather than in a hand-written <nav> means "the product is
 * missing most of its features" becomes something a test can catch instead of
 * something a person has to notice. modules.test.ts asserts every entry here
 * has a route mounted in App.tsx, and that the count is still eleven.
 *
 * `tone` is the module's colour, drawn from the marketing palette. Six colours
 * across eleven modules means repeats; the ordering below keeps any two
 * neighbours in the sidebar distinct, which is the only place the repetition
 * would read as an accident.
 *
 * The Latin names are the spec's and they are load-bearing in the codebase, but
 * nobody signing in at 11pm wants to hunt for "Convocare" when they mean the
 * meeting on Thursday. Both go in the nav: the plain word leads.
 */

import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  CalendarDays,
  Gavel,
  HandCoins,
  Landmark,
  MessagesSquare,
  Network,
  PenLine,
  Send,
  ShieldAlert,
  Users,
} from 'lucide-react';

export type Tone = 'flame' | 'gold' | 'teal' | 'deep' | 'plum' | 'rose';

export interface ModuleDef {
  /** §5 number, for cross-referencing the spec from the UI. */
  section: string;
  /** Route under /app. */
  path: string;
  /** What a person calls it. */
  name: string;
  /** What the spec and the schema call it. */
  latin: string;
  tone: Tone;
  icon: LucideIcon;
  /** One line, used on the module's page header and on the overview grid. */
  blurb: string;
  /** Sidebar grouping. */
  group: 'People' | 'Organizing' | 'Money' | 'Inside the group' | 'Help';
}

export const MODULES: ModuleDef[] = [
  {
    section: '5.1',
    path: '/people',
    name: 'People',
    latin: 'Membra',
    tone: 'flame',
    icon: Users,
    blurb: 'The list everything else writes to — contacts, consent, tags and turf.',
    group: 'People',
  },
  {
    section: '5.2',
    path: '/relationships',
    name: 'Relationships',
    latin: 'Vinculum',
    tone: 'rose',
    icon: Network,
    blurb: 'One-to-ones, follow-ups that come back, and who knows whom.',
    group: 'People',
  },
  {
    section: '5.3',
    path: '/events',
    name: 'Events',
    latin: 'Convocare',
    tone: 'gold',
    icon: CalendarDays,
    blurb: 'Meetings, shifts, RSVPs and check-in. Accessibility on every one.',
    group: 'Organizing',
  },
  {
    section: '5.4',
    path: '/outreach',
    name: 'Outreach',
    latin: 'Nuntius',
    tone: 'teal',
    icon: Send,
    blurb: 'Email, peer-to-peer texting and the dialer — one opt-out stops all of it.',
    group: 'Organizing',
  },
  {
    section: '5.5',
    path: '/advocacy',
    name: 'Advocacy',
    latin: 'Petitio',
    tone: 'deep',
    icon: Landmark,
    blurb: 'Write the bill, find a sponsor, track what the office said back.',
    group: 'Organizing',
  },
  {
    section: '5.6',
    path: '/money',
    name: 'Money',
    latin: 'Thesaurus',
    tone: 'gold',
    icon: HandCoins,
    blurb: 'Dues, donations and escrowed mutual aid. Zero platform take on bail.',
    group: 'Money',
  },
  {
    section: '5.7',
    path: '/messages',
    name: 'Messages',
    latin: 'Colloquium',
    tone: 'plum',
    icon: MessagesSquare,
    blurb: 'Channels that forget on a schedule. We keep envelopes, not contents.',
    group: 'Inside the group',
  },
  {
    section: '5.8',
    path: '/governance',
    name: 'Governance',
    latin: 'Consilium',
    tone: 'deep',
    icon: Gavel,
    blurb: 'Proposals, quorum, ballots and minutes. Secret means secret.',
    group: 'Inside the group',
  },
  {
    section: '5.9',
    path: '/safety',
    name: 'Safety',
    latin: 'Custos',
    tone: 'flame',
    icon: ShieldAlert,
    blurb: 'Jail support, legal observers, rights guides, and a panic wipe.',
    group: 'Inside the group',
  },
  {
    section: '5.10',
    path: '/drafting',
    name: 'Drafting',
    latin: 'Scriba',
    tone: 'teal',
    icon: PenLine,
    blurb: 'A model that never sees a name and never trains on your group.',
    group: 'Help',
  },
  {
    section: '5.11',
    path: '/coalition',
    name: 'Coalition',
    latin: 'Federatio',
    tone: 'rose',
    icon: BadgeCheck,
    blurb: 'Parent and chapters. A parent sees totals until a chapter says otherwise.',
    group: 'Help',
  },
];

export const GROUPS: ModuleDef['group'][] = [
  'People',
  'Organizing',
  'Money',
  'Inside the group',
  'Help',
];

export const moduleAt = (pathname: string): ModuleDef | undefined =>
  MODULES.find((m) => pathname === m.path || pathname.startsWith(`${m.path}/`));

/**
 * Tailwind cannot see a class name that is assembled at runtime, so the tone
 * classes are written out rather than interpolated. This is the documented
 * escape hatch and the reason `bg-${tone}` would silently produce no CSS.
 */
export const TONE_TEXT: Record<Tone, string> = {
  flame: 'text-flame',
  gold: 'text-gold',
  teal: 'text-teal',
  deep: 'text-deep',
  plum: 'text-plum',
  rose: 'text-rose',
};

export const TONE_BG: Record<Tone, string> = {
  flame: 'bg-flame',
  gold: 'bg-gold',
  teal: 'bg-teal',
  deep: 'bg-deep',
  plum: 'bg-plum',
  rose: 'bg-rose',
};

export const TONE_WASH: Record<Tone, string> = {
  flame: 'bg-flame/10',
  gold: 'bg-gold/10',
  teal: 'bg-teal/10',
  deep: 'bg-deep/10',
  plum: 'bg-plum/10',
  rose: 'bg-rose/10',
};

/** The CSS custom property a page sets so `.eyebrow`, `.figure` and `.tone-rule` follow. */
export const toneVar = (tone: Tone) => ({ '--tone': `var(--${tone})` }) as React.CSSProperties;
