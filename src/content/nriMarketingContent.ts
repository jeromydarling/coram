/**
 * NRI Marketing Page Content — Recognize · Synthesize · Prioritize
 *
 * WHAT: Centralized copy for the /nri marketing page + reusable trust/micro-copy.
 * WHERE: Consumed by NRI.tsx, tooltips, onboarding, AI Transparency page.
 * WHY: Single source of truth for NRI messaging across all surfaces.
 */

/* ────────────────────────────────────────────
   HERO VARIANTS (choose one for above-the-fold)
   ──────────────────────────────────────────── */

export const heroVariantA = {
  eyebrow: 'Narrative Relational Intelligence',
  title: 'The Intelligence That Begins With People',
  subtitle:
    'NRI™ is not AI that decides for you.\nIt is AI that serves your attention — so you can stay present to the people who matter.',
  footnote: 'AI processes data. NRI™ helps you notice what matters.',
};

export const heroVariantB = {
  eyebrow: 'Narrative Relational Intelligence',
  title: 'Recognize · Synthesize · Prioritize',
  subtitle:
    'A quiet intelligence that watches what a machine should watch,\nso you can do what only a human can do.',
  footnote: 'Not another dashboard. A companion for your attention.',
};

// Active hero (swap variants here)
export const activeHero = heroVariantA;

/* ────────────────────────────────────────────
   WHAT AI IS GOOD FOR
   ──────────────────────────────────────────── */

export const aiStrengths = {
  heading: 'What AI Is Good For',
  body: [
    'Artificial Intelligence has always extended human capability — from calculators to calendars to language models.',
    'AI excels at pattern recognition, organization, speed, and memory.',
    "That's what machines are for.",
  ],
  bullets: ['Pattern recognition', 'Organization', 'Speed', 'Memory'],
  bridge:
    "CROS™ embraces these strengths. We let the machine do what it does well — so you don't have to.",
};

/* ────────────────────────────────────────────
   WHERE AI STOPS
   ──────────────────────────────────────────── */

export const aiLimits = {
  heading: 'Where AI Stops',
  body: [
    'AI can identify patterns in language, but it cannot feel the weight of a conversation.',
    'It can summarize a meeting, but it cannot understand what courage it took to show up.',
    'AI has no lived experience. No presence. No moral responsibility.',
  ],
  closing:
    'So CROS™ keeps humans in the role of meaning and responsibility. The machine organizes. You decide what it means.',
};

/* ────────────────────────────────────────────
   THE NRI CORE LOOP — Recognize · Synthesize · Prioritize
   ──────────────────────────────────────────── */

export const coreLoop = {
  heading: 'Recognize · Synthesize · Prioritize',
  intro:
    'NRI™ follows a simple rhythm. It does three things — and only three things — so you can focus on the work that matters.',
  steps: [
    {
      label: 'Recognize',
      description:
        'Signals of care, movement, strain, and restoration. NRI notices what is changing — a visit pattern shifting, a partner going quiet, a life event emerging — so nothing important slips through.',
      examples: [
        'A visit frequency change surfaces gently in your Compass',
        'A life event is logged and connected to the person\'s story',
        'A partner who hasn\'t been contacted is noticed — not flagged',
      ],
    },
    {
      label: 'Synthesize',
      description:
        'Scattered notes, visits, events, and emails are folded into a coherent narrative — not a spreadsheet. NRI builds a living summary that grows with your work.',
      examples: [
        'Voice notes + visit logs + reflections become a partner story',
        'Weekly patterns across your territory form a Compass suggestion',
        'Seasonal themes emerge from what you\'ve already written',
      ],
    },
    {
      label: 'Prioritize',
      description:
        'NRI suggests the next small, faithful step. Not a task list explosion. Not a performance score. Just a quiet pointer toward what deserves your attention today.',
      examples: [
        'The Compass surfaces one relationship worth revisiting',
        '"You haven\'t reflected on this partner in three weeks"',
        'A restoration prompt when something seems to have drifted',
      ],
    },
  ],
  closing:
    'All of this lives in the Compass — one calm place for suggestions, not scattered alerts across the interface.',
};

/* ────────────────────────────────────────────
   WHY THIS MATTERS — Adoption Bridge
   ──────────────────────────────────────────── */

export const adoptionBridge = {
  heading: 'Why This Matters',
  hurdles: [
    {
      objection: '"I don\'t want another app."',
      response:
        'CROS™ is not another app demanding your attention. It is one place that remembers — visits, reflections, events, and emails — so you don\'t have to keep it all in your head or across five tools. It reduces cognitive load. It doesn\'t add to it.',
    },
    {
      objection: '"I\'m uneasy about AI."',
      response:
        'That unease is reasonable. NRI™ is bounded by design. It does not surveil. It does not publish. It does not decide. It organizes what you\'ve already shared and suggests — gently — where your attention might go next. You remain responsible. Always.',
    },
  ],
};

/* ────────────────────────────────────────────
   PRINCIPLES — Universal Human Needs
   ──────────────────────────────────────────── */

export const principles = {
  heading: 'Grounded in Human Principles',
  intro:
    'NRI™ is shaped by principles that belong to every community — not to any single tradition.',
  items: [
    {
      name: 'Subsidiarity',
      definition: 'The person closest to the relationship holds the narrative.',
      example:
        'A mentor knows their mentee better than any dashboard. NRI keeps that knowledge with the mentor, not in a centralized report.',
    },
    {
      name: 'Solidarity',
      definition: 'We can share burdens without exposing private details.',
      example:
        'Communio lets organizations share anonymized movement signals — learning from each other without revealing anyone\'s story.',
    },
    {
      name: 'Common Good',
      definition: 'Shared flourishing requires shared awareness.',
      example:
        'Aggregated, anonymized patterns help communities see where energy is growing and where support is needed — without exposing individuals.',
    },
  ],
};

/* ────────────────────────────────────────────
   TRUST & BOUNDARIES (Reusable across pages)
   ──────────────────────────────────────────── */

export const trustBoundaries = {
  heading: 'Trust & Boundaries',
  intro: 'NRI™ earns trust by being clear about what it will never do.',
  commitments: [
    { statement: 'NRI does not sell data.', detail: 'Your reflections, relationships, and community signals are never monetized or shared with third parties.' },
    { statement: 'NRI does not publish private content.', detail: 'Reflections are sacred. Nothing surfaces publicly without explicit human action.' },
    { statement: 'NRI can be configured and limited.', detail: 'Usage caps exist. Intelligence modes can be adjusted. You control how much AI participates in your workflow.' },
    { statement: 'Private by default.', detail: 'When in doubt, NRI assumes privacy. Operator-level views show aggregates, never individual private details.' },
    { statement: 'Humans remain responsible.', detail: 'NRI suggests. It never acts autonomously. Every decision, every response, every next step belongs to you.' },
  ],
};

/* ────────────────────────────────────────────
   RESTORATION — "Nothing is lost here"
   ──────────────────────────────────────────── */

export const restoration = {
  body: 'Nothing is lost here. If something drifts — a relationship, a reflection, a record — CROS™ preserves what matters. Undo, restore, and recover are built into the rhythm. NRI quietly notices when something may need revisiting, and offers the path back without urgency.',
};

/* ────────────────────────────────────────────
   CLOSING MANIFESTO
   ──────────────────────────────────────────── */

export const closingManifesto = {
  heading: 'AI Organizes. Humans Understand.',
  body: [
    'CROS™ does not replace human intelligence. It creates space for it.',
    'By allowing AI to manage the mechanics of organization, NRI™ gives people back the freedom to listen, to reflect, and to act with clarity.',
    'NRI quietly switches between task support and narrative understanding — helping you do the thing when needed, and see the movement when it matters.',
  ],
  closing: 'Because technology should never replace the human story.\nIt should help us remember it.',
  cta: {
    primary: { label: 'Get started', to: '/pricing' },
    secondary: [
      { label: 'See roles', to: '/roles' },
      { label: 'Explore Signals', to: '/signum' },
      { label: 'AI Transparency', to: '/legal/ai-transparency' },
    ],
  },
  earlyAdopter: 'Start small. One relationship. One week. See what you notice.',
};

/* ────────────────────────────────────────────
   MICRO-COPY — In-product tooltips & onboarding
   ──────────────────────────────────────────── */

export const nriMicroCopy = {
  /** Onboarding welcome tooltip */
  onboardingWelcome:
    'NRI™ quietly organizes your reflections, visits, and events into a living story — so you can focus on the people, not the paperwork.',

  /** Compass explainer */
  compassExplainer:
    'The Compass surfaces gentle suggestions based on your activity — one next step at a time, never a task list.',

  /** Reflection prompt context */
  reflectionContext:
    'Your reflections become part of a growing narrative. NRI uses them to notice patterns — never to judge.',

  /** Privacy reassurance (settings/onboarding) */
  privacyReassurance:
    'NRI is private by default. Your data is never sold, and reflections are never published without your action.',

  /** AI mode explainer */
  aiModeExplainer:
    'NRI works in two quiet modes: helping you act on what\'s next, and helping you see the story forming over time.',

  /** Trust boundary (AI transparency tooltip) */
  trustBoundary:
    'NRI suggests, but never decides. Every next step belongs to you.',
};

/* ────────────────────────────────────────────
   FAQ (updated)
   ──────────────────────────────────────────── */

export const nriFaq = [
  {
    question: 'What is NRI™?',
    answer:
      'Narrative Relational Intelligence — a human-first intelligence layer that recognizes signals, synthesizes stories, and prioritizes your attention based on reflections, events, and community presence.',
  },
  {
    question: 'How is NRI different from AI?',
    answer:
      'AI processes data. NRI grounds that processing in human relationships and lived experience. It suggests — it never decides.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Yes. NRI is private by default. Reflections are never published without your action, data is never sold, and operators see only aggregated patterns — never individual private content.',
  },
  {
    question: 'Do I need technical skills to use NRI?',
    answer:
      'No. NRI works quietly behind the scenes, surfacing gentle suggestions in the Compass based on your team\'s reflections and community presence.',
  },
  {
    question: 'What does "Recognize · Synthesize · Prioritize" mean?',
    answer:
      'These are the three things NRI does: it recognizes signals of care and change, synthesizes scattered information into coherent stories, and prioritizes your attention toward the next faithful step.',
  },
];
