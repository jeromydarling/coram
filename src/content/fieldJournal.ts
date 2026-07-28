/**
 * fieldJournal — The Living Field Journal content registry.
 *
 * WHAT: Curated narrative field moments demonstrating relational mission work.
 * WHERE: Rendered on /field-journal and /field-journal/:slug pages.
 * WHY: Builds SEO authority through pastoral storytelling, not promotion.
 */

export interface FieldJournalEntry {
  slug: string;
  title: string;
  archetype: string;
  roles: string[];
  summary: string;
  body: string;
  signals?: string[];
  lessons?: string[];
  publishedDate?: string;
}

export const FIELD_JOURNAL: FieldJournalEntry[] = [
  {
    slug: 'a-volunteer-who-prefers-email',
    title: 'When a volunteer prefers email over apps',
    archetype: 'church',
    roles: ['Steward', 'Visitor'],
    summary: 'A parish learns to meet volunteers where they are.',
    body: [
      'Margaret has been visiting homebound parishioners for eleven years. She writes her notes on index cards and drops them in a basket on the parish secretary desk every Friday afternoon.',
      'When the parish adopted CROS, the steward assumed everyone would switch to the app. Margaret tried. She found the font too small, the screen too bright at night, and the idea of typing on glass while sitting with someone who just wanted company \u2014 uncomfortable.',
      'So the steward did something quiet. She created a shared email address and told Margaret: "Just send me a note after each visit. Even one sentence is enough."',
      'Margaret now sends short emails \u2014 "Visited Helen. She seemed stronger today. Asked about the choir." The steward enters them as reflections. Margaret never logs in. But her presence is recorded, her observations honored, and the narrative thread she holds \u2014 eleven years of visiting \u2014 remains unbroken.',
      'The lesson was not about technology adoption. It was about asking: what does presence look like for this person?',
    ].join('\n\n'),
    signals: ['presence-signal', 'drift-detection'],
    lessons: [
      'Adoption does not require everyone to use the same interface.',
      'Email can be a valid entry point for reflection.',
      'Honoring existing rhythms prevents volunteer burnout.',
    ],
    publishedDate: '2025-11-15',
  },
  {
    slug: 'first-week-after-activation',
    title: 'The quiet week after activation',
    archetype: 'nonprofit',
    roles: ['Leader', 'Shepherd'],
    summary: 'What the first seven days actually feel like \u2014 less fanfare, more noticing.',
    body: [
      'The activation call was energizing. The team saw the journey stages, explored the reflection tool, and talked about how they would track visits differently now. Then the call ended.',
      'Monday arrived. The director opened CROS and stared at an empty dashboard. No reflections. No visits logged. No signals. Just white space.',
      'This is normal.',
      'The first week after activation is almost always quiet. Teams are still in their old rhythms \u2014 paper notes, mental tallies, hallway conversations. The system feels new. The instinct to "wait until I have something real to enter" is strong.',
      'By Wednesday, the director wrote her first reflection: "Met with Rosa\'s family. They are struggling with the new school schedule. I told them about the after-school program at St. Anne\'s." It was one sentence. But it was the beginning.',
      'By Friday, two more team members had logged reflections. Not because they were told to \u2014 but because they saw the director\'s entry and thought: "Oh. That is all it is. Just writing down what I noticed."',
      'The quiet week is not a failure. It is the ground settling before the garden grows.',
    ].join('\n\n'),
    signals: ['momentum-signal'],
    lessons: [
      'The first week is always quiet \u2014 that is healthy.',
      'Leaders who model reflection unlock team adoption.',
      'Small entries matter more than comprehensive ones.',
    ],
    publishedDate: '2025-12-01',
  },
  {
    slug: 'when-drift-detection-was-right',
    title: 'When drift detection was right \u2014 and when it was not',
    archetype: 'catholic_outreach',
    roles: ['Shepherd', 'Visitor'],
    summary: 'Two drift signals, two different truths.',
    body: [
      'Sister Catherine received two drift signals on the same Tuesday morning.',
      'The first said: "No recorded visits with the Nguyen family in 42 days." She checked her memory. The Nguyens had been traveling \u2014 visiting family in Vietnam for six weeks. The drift was accurate but not meaningful. She dismissed it with a note: "Family traveling. Expected return mid-March."',
      'The second said: "No recorded visits with James Patterson in 38 days." She paused. James had been struggling. His wife had passed four months ago. Catherine had meant to visit every two weeks. Somewhere between a flu and a parish event, the rhythm had broken.',
      'She visited James that afternoon. He said: "I wondered if everyone had forgotten."',
      'Drift detection does not know which signals matter. It simply notices what has gone quiet. The shepherd decides whether that quiet is peaceful or painful. That discernment \u2014 that human layer \u2014 is why NRI is not artificial intelligence. It is relational intelligence, held by a person.',
    ].join('\n\n'),
    signals: ['drift-detection', 'presence-signal'],
    lessons: [
      'Not every drift signal requires action \u2014 but every one deserves attention.',
      'The human interpreter is irreplaceable.',
      'Dismissal notes preserve institutional memory.',
    ],
    publishedDate: '2026-01-10',
  },
  {
    slug: 'the-morning-the-dashboard-was-empty',
    title: 'The morning the dashboard was empty',
    archetype: 'social_enterprise',
    roles: ['Leader'],
    summary: 'A workforce director learns that an empty dashboard can be a good sign.',
    body: [
      'Keisha opened CROS on a Monday morning expecting her usual signals \u2014 follow-up suggestions, visit reminders, maybe a drift notice. Instead, nothing. The dashboard was calm. No pending reflections to review. No unresponded signals.',
      'Her first reaction was concern: "Is something broken?" She checked the system health panel. Everything was running. Automations were green. The team had logged visits Friday afternoon.',
      'Then she realized: the quiet was not a malfunction. It was the sound of a team in rhythm. Her companions had visited everyone on schedule. Her shepherd had written reflections. The steward had processed provisioning requests. There was nothing left undone.',
      'In most systems, quiet means neglect. In CROS, quiet can mean harmony. Keisha made herself a cup of tea and spent the morning reading through last week\'s reflections instead. She found stories she had missed \u2014 a participant who had gotten her GED, a volunteer who had connected two families.',
      'Sometimes the most important thing a dashboard can do is get out of the way.',
    ].join('\n\n'),
    signals: ['momentum-signal', 'presence-signal'],
    lessons: [
      'Quiet dashboards can indicate health, not failure.',
      'Reading reflections is as valuable as responding to signals.',
      'The system should support noticing, not create noise.',
    ],
    publishedDate: '2026-01-25',
  },
  {
    slug: 'naming-the-journey-stages',
    title: 'Naming the journey stages together',
    archetype: 'workforce',
    roles: ['Steward', 'Leader', 'Shepherd'],
    summary: 'A team discovers that choosing the right words changes everything.',
    body: [
      'The workforce development team had been using CROS for three weeks with the default journey stages: "First Encounter \u2192 Growing Trust \u2192 Active Partnership." But the language felt off.',
      '"We do not have partners," Marcus said during the weekly team meeting. "We have participants. And \'Growing Trust\' \u2014 that is not wrong, but it sounds like we are managing them. We are not. We are walking with them."',
      'The steward opened the archetype settings and the team spent forty-five minutes renaming their journey stages:',
      'Intake became "Welcome." Assessment became "Understanding." Training became "Building Together." Placement became "Stepping Forward." Retention became "Staying Connected."',
      'It seemed like a small change. But the following week, reflection entries shifted. Instead of writing "Moved client from Assessment to Training," shepherds wrote "Maria is ready to build together \u2014 she chose the welding track."',
      'The language shaped the story. The story shaped the care.',
    ].join('\n\n'),
    signals: ['momentum-signal'],
    lessons: [
      'Journey stage names shape how teams think about people.',
      'Customizing vocabulary is a form of mission alignment.',
      'Small language changes ripple through reflection quality.',
    ],
    publishedDate: '2026-02-05',
  },
  {
    slug: 'what-the-visitor-saw',
    title: 'What the visitor saw that no one else noticed',
    archetype: 'church',
    roles: ['Visitor', 'Shepherd'],
    summary: 'A communion visitor\'s quiet observation changed how a parish responded.',
    body: [
      'David brings communion to six homebound parishioners every Sunday. He has been doing it for three years. Most visits last twenty minutes \u2014 a prayer, the Eucharist, a few minutes of conversation about the week.',
      'One Sunday at the Morales home, something was different. The house was unusually dark. Mrs. Morales, who normally had coffee ready, was sitting in the kitchen without the lights on. She received communion quietly and said she was fine.',
      'David wrote a one-line reflection in CROS that evening: "Morales home dark. Ana quiet. Something different."',
      'The shepherd, Father Miguel, saw the reflection Monday morning. He knew Ana\'s husband had been in the hospital the previous week. The reflection connected two dots that neither person held alone \u2014 David\'s observation and Miguel\'s knowledge.',
      'Miguel visited that afternoon. Ana\'s husband had been diagnosed with early-stage dementia. She had not told anyone at the parish. She was carrying it alone.',
      'David\'s reflection was not a diagnosis. It was not a report. It was a human being noticing that the light had changed \u2014 and trusting the system enough to write it down.',
      'This is what Narrative Relational Intelligence means. Not the AI processing. The human noticing.',
    ].join('\n\n'),
    signals: ['presence-signal', 'drift-detection'],
    lessons: [
      'Brief observations can carry profound significance.',
      'Visitors often see what leaders cannot.',
      'The system\'s value is in connecting observations across roles.',
    ],
    publishedDate: '2026-02-15',
  },
];

/** Get a field journal entry by slug. */
export function getFieldJournalEntry(slug: string): FieldJournalEntry | undefined {
  return FIELD_JOURNAL.find((e) => e.slug === slug);
}

/** Get entries by archetype. */
export function getFieldJournalByArchetype(archetype: string): FieldJournalEntry[] {
  return FIELD_JOURNAL.filter((e) => e.archetype === archetype);
}

/** Get unique archetypes represented. */
export function getFieldJournalArchetypes(): string[] {
  return [...new Set(FIELD_JOURNAL.map((e) => e.archetype))];
}

/** Get role frequency across entries. */
export function getFieldJournalRoleFrequency(): Record<string, number> {
  const freq: Record<string, number> = {};
  FIELD_JOURNAL.forEach((e) => e.roles.forEach((r) => { freq[r] = (freq[r] || 0) + 1; }));
  return freq;
}
