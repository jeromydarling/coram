/**
 * imagineThis — Content for the "Imagine This" narrative marketing page.
 *
 * WHAT: All copy for scenario cards, quiet comparison, reflections, and closing.
 * WHERE: Used by /imagine-this page component.
 * WHY: Centralised content keeps JSX clean; Ignatian tone maintained in one place.
 */

export const imagineHero = {
  heading: 'Imagine This.',
  subtext:
    'What if your work felt less like managing systems —\nand more like walking alongside people again?',
};

export interface ImagineScenario {
  label: string;
  title: string;
  paragraphs: string[];
}

export const scenarios: ImagineScenario[] = [
  {
    label: 'Social Work',
    title: 'Imagine visiting a family — and your system already remembers what matters.',
    paragraphs: [
      'You arrive at a home visit. Before you knock, a quiet note surfaces: the last two visits focused on housing stability. A voice note from three weeks ago reminds you that the youngest child just started school.',
      "You don\u2019t search for this. It\u2019s there because the system was built to hold context \u2014 not just records.",
      "After the visit, you speak a short note into your phone. It becomes part of the family\u2019s story, not a line in a spreadsheet.",
    ],
  },
  {
    label: 'Nonprofit Leadership',
    title: 'Imagine knowing where your community is moving — without running reports.',
    paragraphs: [
      'You open your dashboard on a Monday morning. Instead of charts, you see a narrative: "Three volunteers showed renewed momentum this week. Two partners deepened their engagement after the community meal."',
      "You didn\u2019t ask for a report. The system noticed movement \u2014 and shared it in words you\u2019d actually use with your board.",
      'Your volunteers feel seen. Your leadership sees direction. Nobody had to export a CSV.',
    ],
  },
  {
    label: 'Ministry & Faith Community',
    title: 'Imagine a system that helps you notice — not just manage.',
    paragraphs: [
      "A small group leader logs a reflection after a Wednesday gathering. She doesn\u2019t write much \u2014 just that one member seemed quieter than usual, and another mentioned a job transition.",
      "Over time, these quiet observations weave into a pattern. The pastoral team doesn\u2019t need a meeting to surface what matters \u2014 the system holds it gently.",
      'When someone reaches out months later, the context is already there. Not because it was tracked. Because it was remembered.',
    ],
  },
];

export interface ComparisonRow {
  before: string;
  withCros: string;
}

export const quietComparison = {
  heading: 'A Quiet Comparison',
  subtext:
    'Many teams don\'t realize how much effort disappears into tools that were never built for relationships.',
  rows: [
    {
      before: 'Notes scattered across inboxes, spreadsheets, and sticky notes.',
      withCros: 'Every visit, call, and reflection lives in one quiet story — not a data silo.',
    },
    {
      before: "Activity logged but never understood. Data grows; clarity doesn\u2019t.",
      withCros: 'Movement becomes visible. Patterns surface in human language, not pivot tables.',
    },
    {
      before: 'Relationships flattened into records. People become rows.',
      withCros: 'People feel known, not processed. Context travels with you.',
    },
    {
      before: 'Volunteers avoid logging in. Adoption stalls after onboarding.',
      withCros: 'The system meets people where they are — voice notes, gentle guidance, calm rhythm.',
    },
    {
      before: 'Leadership sees dashboards. Nobody sees direction.',
      withCros: 'Leaders receive narrative signals — what\'s shifting, who\'s growing, what deserves attention.',
    },
  ] as ComparisonRow[],
};

export const possibilityBlock = {
  heading: 'What becomes possible when systems stop competing for attention?',
  reflections: [
    'Field teams spend less time documenting and more time listening.',
    'Leaders make decisions from stories, not spreadsheets.',
    'Volunteers feel trusted — and the system trusts them back.',
    'Community signals surface without anyone running a query.',
    'The rhythms of care become visible without being measured to death.',
  ],
};

export interface ReflectionItem {
  question: string;
  followUp: string;
}

export const reflections: ReflectionItem[] = [
  {
    question: 'What would change if your team could record a visit by speaking instead of typing?',
    followUp: 'Voice notes reduce friction. When logging feels natural, more stories get preserved.',
  },
  {
    question: 'How would your board respond to a narrative summary instead of a metrics dashboard?',
    followUp: 'Numbers prove what happened. Stories reveal why it matters.',
  },
  {
    question: 'If a volunteer opened your system right now, would they know what to do?',
    followUp: "Adoption isn\u2019t a training problem. It\u2019s a design problem.",
  },
  {
    question: "When was the last time your tools surfaced something you didn\u2019t already know?",
    followUp: 'Systems that only store what you enter can never surprise you with insight.',
  },
  {
    question: 'Could you describe the journey of one person you serve — from memory and from your system?',
    followUp: 'If the system version feels thinner than the memory, something is being lost.',
  },
];

export const closing = {
  body: 'CROS isn\'t asking you to imagine a new platform.\nIt\'s inviting you to imagine a different rhythm of care.',
  links: [
    { label: 'Explore Archetypes', to: '/archetypes' },
    { label: 'What a Week Looks Like', to: '/archetypes/church/week' },
  ],
};
