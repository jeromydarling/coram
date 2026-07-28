/**
 * weekNarratives — Story-first content for "What a Week Looks Like" pages.
 *
 * WHAT: Static narrative content for /week/:slug pages.
 * WHERE: Used by WeekNarrativePage.tsx.
 * WHY: Demonstrates daily life inside CROS™ through human-centered storytelling.
 */

export interface WeekDay {
  day: string;
  title: string;
  body: string;
}

export interface WeekNarrative {
  slug: string;
  role: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  days: WeekDay[];
  closingReflection: string;
}

export const weekNarratives: WeekNarrative[] = [
  {
    slug: 'catholic-visitor',
    role: 'Visitor',
    title: 'A Week as a Visitor',
    seoTitle: 'What a Week Looks Like in CROS™ | Visitor',
    seoDescription: 'A realistic look at how parish visitors use CROS™ each week — no dashboards, just presence, voice notes, and the quiet work of remembering people.',
    intro: 'Some people keep spreadsheets. Some keep paper lists. Some keep everything in memory. But visiting isn\u2019t about data \u2014 it\u2019s about presence.',
    days: [
      {
        day: 'Monday',
        title: 'Preparing the Path',
        body: 'The Visitor opens Profunda on a simple device. They don\u2019t see dashboards. They see today\u2019s visits and familiar faces. A gentle reminder surfaces \u2014 Mrs. Alvarez mentioned her grandson last time. The Visitor pauses and remembers.',
      },
      {
        day: 'Tuesday',
        title: 'Walking the Route',
        body: 'Two homes today. Neither expects a report. Both expect a conversation. The Visitor carries nothing but a phone and a willingness to listen. CROS\u2122 stays in the background, holding what was said before so the Visitor can be fully present now.',
      },
      {
        day: 'Wednesday',
        title: 'The Visit',
        body: 'A conversation happens \u2014 the kind that can\u2019t be captured in a form. Instead of typing, the Visitor records a voice note on the walk back to the car. The system listens and remembers. No one had to learn software.',
      },
      {
        day: 'Thursday',
        title: 'The Thread Continues',
        body: 'A follow-up appears quietly. Last week\u2019s visit mentioned a medical appointment. The Visitor doesn\u2019t need to search through notes \u2014 the thread is already there, waiting. A brief text message is enough.',
      },
      {
        day: 'Friday',
        title: 'The Circle',
        body: 'Back at the parish hall, the team gathers. No scraps of paper \u2014 just the story of what happened this week. The Shepherd reads a summary that feels human, not clinical. Everyone knows where things stand without anyone having to explain.',
      },
    ],
    closingReflection: 'Technology disappears when it serves people well.',
  },
  {
    slug: 'shepherd',
    role: 'Shepherd',
    title: 'A Week as a Shepherd',
    seoTitle: 'What a Week Looks Like in CROS™ | Shepherd',
    seoDescription: 'A realistic look at how mission leaders use CROS™ each week — narrative intelligence, community pulse, and the art of holding stories.',
    intro: 'The Shepherd doesn\u2019t manage tasks. They hold the longer story \u2014 the one that connects this week\u2019s visits to last year\u2019s conversations, and both of those to the mission\u2019s deeper purpose.',
    days: [
      {
        day: 'Monday',
        title: 'The Command Center',
        body: 'The Shepherd opens Profunda and reads the pulse of the community. Not metrics \u2014 narratives. Which relationships are growing? Which have gone quiet? The dashboard doesn\u2019t shout. It whispers.',
      },
      {
        day: 'Tuesday',
        title: 'Listening to the Narrative',
        body: 'Testimonium gathers reflections quietly. A Companion logged a visit yesterday. A Visitor recorded a voice note. The Shepherd reads the threads and senses where the community is moving \u2014 not through analytics, but through story.',
      },
      {
        day: 'Wednesday',
        title: 'Noticing Drift',
        body: 'A gentle signal appears. A longtime volunteer hasn\u2019t been mentioned in three weeks. No alarm \u2014 just a quiet observation. The Shepherd makes a mental note and sends a warm message. That\u2019s all it takes.',
      },
      {
        day: 'Thursday',
        title: 'Guiding Without Micromanaging',
        body: 'A volunteer logs activity. A Visitor records a note. The Shepherd doesn\u2019t intervene \u2014 they respond with care. A comment here. An encouragement there. The work continues because people feel supported, not supervised.',
      },
      {
        day: 'Saturday',
        title: 'Seeing the Bigger Picture',
        body: 'Momentum appears in a neighboring metro. A community partner has started something new. Expansion becomes imagination, not pressure. The Shepherd wonders aloud: "What if we joined them?" The story grows.',
      },
    ],
    closingReflection: 'The Shepherd doesn\u2019t manage data \u2014 they hold stories.',
  },
  {
    slug: 'steward',
    role: 'Steward',
    title: 'A Week as a Steward',
    seoTitle: 'What a Week Looks Like in CROS™ | Steward',
    seoDescription: 'A realistic look at how operational stewards use CROS™ each week — quiet oversight, volunteer onboarding, and ecosystem care.',
    intro: 'Stewardship is invisible work. When it\u2019s done well, no one notices \u2014 because everything just works. The Steward makes that possible.',
    days: [
      {
        day: 'Monday',
        title: 'Quiet Oversight',
        body: 'Activation progress, volunteers, outreach signals \u2014 all in one calm space. The Steward doesn\u2019t need to chase anyone. The system surfaces what needs attention gently, and everything else stays quiet.',
      },
      {
        day: 'Tuesday',
        title: 'Bringing People In',
        body: 'A new volunteer prefers email. Another prefers a quick phone call. The Steward shares one intake address. No training manual required. No complicated onboarding. Just a warm welcome and a clear next step.',
      },
      {
        day: 'Wednesday',
        title: 'Keeping Things Connected',
        body: 'A provision request comes in from the field. The Steward routes it without disruption. The Companion who requested it doesn\u2019t need to follow up \u2014 the system confirms delivery. Quiet. Reliable.',
      },
      {
        day: 'Thursday',
        title: 'Supporting Without Interrupting',
        body: 'The system connects activities automatically. A visit logged by a Visitor becomes a thread visible to the Shepherd. The Steward didn\u2019t have to do anything \u2014 they set it up once, and now it flows. They protect flow.',
      },
      {
        day: 'Friday',
        title: 'Watching the Ecosystem',
        body: 'The Operator Nexus highlights where help may be needed. A metro shows declining volunteer activity. The Steward flags it gently for the Shepherd. No emergency \u2014 just awareness. The ecosystem stays healthy.',
      },
    ],
    closingReflection: 'Stewardship means making the work easier for others.',
  },
  {
    slug: 'social-outreach',
    role: 'Outreach Team',
    title: 'A Week in Social Outreach',
    seoTitle: 'What a Week Looks Like in CROS™ | Social Outreach',
    seoDescription: 'A realistic look at how nonprofit outreach teams use CROS™ each week — case visits, voice notes, and human-centered intelligence.',
    intro: 'The outreach team doesn\u2019t think in terms of "cases." They think in terms of people \u2014 families navigating complex systems, individuals rebuilding after setbacks, neighbors who need someone to show up.',
    days: [
      {
        day: 'Monday',
        title: 'The Week Ahead',
        body: 'Case managers review their week. Not a list of tasks \u2014 a map of people. Each name carries context: last conversation, ongoing needs, upcoming milestones. The system holds what memory alone cannot.',
      },
      {
        day: 'Tuesday',
        title: 'In the Field',
        body: 'A home visit. The conversation is complex and deeply human. Afterward, a voice note captures the essence \u2014 not a clinical assessment, but a story. "She seemed lighter today. The kids were playing in the yard for the first time."',
      },
      {
        day: 'Wednesday',
        title: 'Patterns Emerging',
        body: 'NRI surfaces something the team hadn\u2019t noticed: three families in the same neighborhood have all mentioned transportation barriers this month. It\u2019s not surveillance \u2014 it\u2019s awareness. The team discusses it over coffee.',
      },
      {
        day: 'Thursday',
        title: 'Coordination Without Bureaucracy',
        body: 'A partner organization is serving the same community. Through Communio, the team sees shared patterns \u2014 anonymized, respectful, useful. They reach out. A simple conversation prevents duplicate effort.',
      },
      {
        day: 'Friday',
        title: 'The Human Report',
        body: 'The weekly summary isn\u2019t a spreadsheet. It\u2019s a narrative \u2014 what changed, who was reached, what the team is feeling. Leadership reads it and understands. No one asks "what are the numbers?" because the story says enough.',
      },
    ],
    closingReflection: 'People are never reduced to data points.',
  },
  {
    slug: 'community-companion',
    role: 'Companion',
    title: 'A Week as a Companion',
    seoTitle: 'What a Week Looks Like in CROS™ | Companion',
    seoDescription: 'A realistic look at how frontline companions use CROS™ each week — logging activities, tracking provisions, and walking alongside people.',
    intro: 'The Companion doesn\u2019t manage systems. They don\u2019t run reports. They walk alongside people \u2014 and that simple act of presence is the most powerful thing any technology can support.',
    days: [
      {
        day: 'Monday',
        title: 'Starting the Thread',
        body: 'The Companion opens their day and sees relationships \u2014 not tasks. Each person has a story in progress. A follow-up from last week. A new introduction from the Shepherd. The thread is already there.',
      },
      {
        day: 'Tuesday',
        title: 'The Daily Walk',
        body: 'Two visits. A phone call. A quick text to check in. Each interaction is logged with a tap \u2014 not because the system demands it, but because the Companion wants the story to continue even if they\u2019re not there tomorrow.',
      },
      {
        day: 'Wednesday',
        title: 'Provisions and Care',
        body: 'A family needs something practical \u2014 a referral, a resource, a connection. The Companion logs a provision request. It moves through the system without friction. By Thursday, it\u2019s resolved.',
      },
      {
        day: 'Thursday',
        title: 'The Unexpected Moment',
        body: 'A conversation takes an unexpected turn. Someone shares something they\u2019ve never shared before. The Companion listens. Later, a brief reflection captures the weight of the moment \u2014 private, sacred, held.',
      },
      {
        day: 'Friday',
        title: 'Closing the Week',
        body: 'The Companion reviews the week \u2014 not for compliance, but for continuity. Did anyone get missed? Is there a thread that needs picking up on Monday? The system shows the gaps gently. Nothing falls through.',
      },
    ],
    closingReflection: 'The Companion moves quietly, but their presence shapes everything.',
  },
];

export function getWeekNarrativeBySlug(slug: string): WeekNarrative | undefined {
  return weekNarratives.find((n) => n.slug === slug);
}
