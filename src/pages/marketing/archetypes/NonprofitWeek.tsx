import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'The Quiet Map',
    narrative: `Marisol arrives at the community tech center before anyone else. She turns on the lights in the lab, sets out the sign-in binder, and opens CROS™ on her laptop.\n\nShe doesn't start with a task list. She starts with the Metro Narrative.\n\nOver the weekend, three families completed the digital literacy course. One participant — Mr. Okonkwo — submitted his first online job application during Saturday's open lab. A Companion logged a quick Reflection: "He was nervous but he stayed until he finished. His daughter helped him with the password."\n\nMarisol reads it twice. She's been working with Mr. Okonkwo for four months. She remembers the first day he came in — he didn't know how to turn on the computer.\n\nShe types a note in his Journey: "First application submitted. Daughter involved — family support is real." Then she moves on. No report to file. No metric to update. Just a moment worth holding.`,
  },
  {
    day: 'Tuesday',
    title: 'Companions at the Table',
    narrative: `Two Companions are in the field today.\n\nDavid runs the mobile hotspot program. He's delivering equipment to a senior housing complex on the east side. He uses the quick-add on his phone: "Installed 3 hotspots at Riverside Towers. Mrs. Chen asked about the tablet lending program again. She's ready."\n\nAcross town, Keisha is running a workshop at the library branch — basic email setup for adults. She logs a Reflection after: "12 participants today. Two women from the Somali community came together. One spoke very little English but her friend translated everything. They want to come back Thursday."\n\nNeither David nor Keisha sees each other's notes. But a quiet pattern is forming — demand is clustering in two neighborhoods. The system holds this without announcing it. It will surface gently later, when it matters.`,
  },
  {
    day: 'Wednesday',
    title: 'The Visit That Mattered',
    narrative: `Marisol visits the Riverside Towers senior complex. Mrs. Chen is waiting in the community room with three neighbors.\n\nThey don't want a class. They want someone to sit with them and show them how to video-call their grandchildren.\n\nMarisol spends two hours there. No curriculum. No slides. Just four women and a tablet, learning to tap the green button.\n\nAfterward, she opens CROS™ in her car and records a voice note: "Visited Riverside. Mrs. Chen and three neighbors — video calling lesson. Mrs. Alvarez cried when she saw her grandson in California. These aren't 'digital literacy outcomes.' These are people reconnecting."\n\nThe voice note is transcribed. It becomes a Visit activity linked to the Riverside Towers Opportunity. The system doesn't try to score it. It just keeps it safe.`,
  },
  {
    day: 'Thursday',
    title: 'Signals in the Neighborhood',
    narrative: `Signum picks up two things from the local news feed.\n\nFirst: the city council approved funding for a new broadband expansion in the east corridor — exactly where David has been delivering hotspots.\n\nSecond: a community health clinic three blocks from the tech center is offering free health screenings next month and needs help with online registration.\n\nNeither of these is urgent. They appear in the Local Pulse feed, tagged with the program's community keywords: "broadband," "digital access," "health equity."\n\nMarisol sees the broadband item and adds a note to the metro Journey: "City funding may reduce hotspot demand in 6 months. Good problem to have. Start thinking about what comes next for Riverside."\n\nShe sees the clinic item and creates a new Opportunity — not a sales lead, but a potential partnership. She writes: "Could offer registration help at our Thursday open lab. Natural fit."`,
  },
  {
    day: 'Friday',
    title: 'The Story Beneath the Numbers',
    narrative: `The weekly rhythm runs quietly.\n\nA pattern emerges across the week's Reflections:\n• Mr. Okonkwo submitted his first job application — after four months of patient work.\n• Demand is growing in two neighborhoods simultaneously.\n• Seniors at Riverside want connection, not curriculum.\n• A health clinic partnership is forming naturally.\n• The Somali women at the library want to come back.\n\nThe Metro Narrative stitches these together into something a funder report never could:\n\n"This week, your community showed signs of deepening trust. A longtime participant reached a milestone. New faces appeared in two locations. A senior housing complex is becoming a gathering point. A potential health partnership emerged from proximity, not strategy."\n\nMarisol reads it in three minutes. She forwards the narrative paragraph to her program director — not as a report, but as a story.`,
  },
  {
    day: 'Saturday',
    title: 'Open Lab, Open Ears',
    narrative: `Saturday open lab. The room fills slowly.\n\nMr. Okonkwo is back — this time helping another man navigate the same job site. Marisol notices but doesn't interrupt. She logs a quick Reflection: "He's teaching now. Four months ago he couldn't log in."\n\nThe Drift Detection gently notes that two regular Tuesday participants haven't come in for three weeks. It doesn't say "at risk." It says: "You might want to check in with James and Priya — they've been quiet lately."\n\nMarisol texts James. He's been working double shifts at a new job — the one he got through the program. He'll be back when things settle.\n\nPriya, it turns out, moved to a different part of the city. She asks if there's a lab closer to her new apartment. There isn't — yet. Marisol notes this in the metro Journey.`,
  },
  {
    day: 'Sunday',
    title: 'What the Week Held',
    narrative: `The center is closed on Sunday. But the week's story is complete.\n\nMarisol knows things no spreadsheet could capture:\n\n• Mr. Okonkwo has gone from learner to teacher in four months.\n• Mrs. Chen and her neighbors don't need digital literacy — they need digital belonging.\n• Two neighborhoods are showing growing demand at the same time.\n• A health clinic wants help, and the help they need is exactly what the program offers.\n• James got a job. Priya moved. Both are signs of lives in motion.\n• Two Somali women found the library because a friend translated for them.\n\nThe grant report will say "47 participants served this quarter." The Metro Narrative will say something truer.\n\nCROS™ didn't create any of this impact. The community did — by showing up, asking questions, and helping each other.\n\nCROS™ just paid attention.`,
  },
];

export default function NonprofitWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Digital Inclusion Nonprofit"
      introLine="See how a digital inclusion team uses CROS™ to remember participants, notice neighborhood patterns, and serve with patient continuity."
      sections={sections}
      closingReflection="CROS™ didn't create any of this impact. The community did — by showing up, asking questions, and helping each other. CROS™ just paid attention."
      slug="nonprofit-week"
    />
  );
}
