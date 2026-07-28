import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'The Intake That Wasn\'t',
    narrative: `Angela runs a workforce development program out of a converted storefront on the west side. Her team serves adults who've been out of work for a long time — some returning from incarceration, some recovering from addiction, some just stuck.\n\nMonday morning, she opens CROS™. Not to check KPIs. To read what happened last week.\n\nA Companion named Marcus logged a Reflection on Friday: "Raymond came in for his appointment but we didn't do the intake form. He wasn't ready. We just talked. He told me about his daughter's birthday party — first one he's been to in three years. We'll try the paperwork next week."\n\nAngela doesn't flag this as a missed milestone. She opens Raymond's Journey and types: "Not ready for intake yet. That's okay. The birthday party matters. Marcus is building trust."\n\nThe system doesn't penalize patience. It holds it.`,
  },
  {
    day: 'Tuesday',
    title: 'Companions in the Field',
    narrative: `Two Companions are working today.\n\nMarcus is at the county job center with a participant named DeShawn, helping him navigate the online application system. He logs a quick note: "DeShawn has warehouse experience but no computer skills. Took 45 minutes to set up an email address. He was embarrassed. I told him most people don't get it right the first time."\n\nMeanwhile, Keandra is running a mock interview workshop at the storefront. Four participants showed up — down from six last week. She writes: "Good session. Terrence wore a tie for the first time. He practiced his handshake three times. Monique didn't come — she mentioned childcare issues last week."\n\nNeither Companion sees the other's notes. But a quiet pattern is forming — barriers to employment aren't just about skills. They're about email passwords, childcare, ties, and trust. The system holds all of this without reducing it to a category.`,
  },
  {
    day: 'Wednesday',
    title: 'The Employer Visit',
    narrative: `Angela visits a local manufacturing company — Midwest Metal Works — that's been a hiring partner for two years.\n\nShe doesn't bring a pitch deck. She brings lunch.\n\nThe HR manager, Janet, tells her they have three openings on the second shift. "But honestly, Angela, the last guy you sent lasted two weeks. What happened?"\n\nAngela knows what happened. She pulls up the Journey for that placement — the participant had a housing crisis in week two. He didn't quit. He disappeared. She explains without sharing private details: "He ran into a personal situation. We should have followed up faster. That's on us."\n\nAfterward, she logs a Reflection: "Janet is patient but losing confidence. We need to improve post-placement support. Can't just place people and walk away."\n\nShe creates a note in the Midwest Metal Works Journey: "Three openings, second shift. DeShawn might be ready in two weeks. But only if we have a support plan this time."`,
  },
  {
    day: 'Thursday',
    title: 'The Pattern Nobody Reported',
    narrative: `The weekly rhythm surfaces something Angela hadn't seen in pieces.\n\nAcross the last month:\n• Four participants mentioned transportation as a barrier — bus routes on the west side were cut in January.\n• Two Companions independently noted that participants are more engaged in one-on-one sessions than group workshops.\n• Post-placement follow-up has been inconsistent — three participants had no check-in after their first week on the job.\n• Raymond isn't the only person who needed a relationship before paperwork.\n\nThe Metro Narrative gathers this:\n\n"This month, your program is seeing a shift. Participants are responding to personal connection more than structured programming. Transportation gaps are widening. Post-placement support needs strengthening. The people closest to the work are noticing what the intake forms miss."\n\nAngela reads this and realizes the pattern: her program is designed for people who are ready. But most of her participants aren't ready yet. They're getting ready. And that takes something no curriculum can provide.`,
  },
  {
    day: 'Friday',
    title: 'Signals from the Street',
    narrative: `Signum picks up two local items.\n\nFirst: the city transit authority announced a temporary shuttle route for the west side, filling the gap left by the January bus cuts. It runs for 90 days.\n\nSecond: a community college is offering a free forklift certification course starting next month — evenings and weekends.\n\nAngela sees the shuttle announcement and immediately thinks of DeShawn — he lives on the west side and the bus cut was going to be a problem for second shift work. She adds a note to his Journey: "Temporary shuttle route announced. Covers his commute to Midwest Metal Works. Good for 90 days — enough time to get established."\n\nShe sees the forklift certification and creates a new Opportunity: "Community College forklift cert — free, evening schedule. Could work for Terrence and two others."\n\nThe system didn't solve the transportation problem. The city did. But the system made sure Angela noticed before the 90 days were half gone.`,
  },
  {
    day: 'Saturday',
    title: 'The Saturday Circle',
    narrative: `Saturday mornings, the storefront hosts an informal gathering — coffee, pastries, no agenda. Participants come if they want to. Nobody takes attendance.\n\nRaymond shows up. It's his first Saturday. He sits in the corner with coffee and doesn't say much. But he stays for an hour.\n\nTerrence shows Marcus his new tie — the one he wore to the mock interview. "My grandmother bought it for me," he says. Marcus doesn't log this. Some things are just between people.\n\nMonique comes with her two kids. She tells Keandra that her mother agreed to watch them on Tuesdays and Thursdays. "I can come to the workshops now," she says.\n\nDrift Detection notes that a participant named Andre hasn't been in contact for four weeks. It says gently: "You might want to check in with Andre — he's been quiet lately."\n\nAngela calls him. He got a job on his own — night shift at a warehouse. He didn't tell anyone because he didn't think the program helped. "But it did," he says. "Marcus taught me how to do the application."`,
  },
  {
    day: 'Sunday',
    title: 'The Real Outcomes',
    narrative: `Sunday is closed. But the week left something behind.\n\nAngela knows things no outcome report could capture:\n\n• Raymond isn't ready for intake, but he's ready for coffee on Saturday mornings. That's the beginning.\n• DeShawn needs a shuttle, a patient employer, and someone who doesn't rush him through email setup.\n• Terrence wore a tie and practiced his handshake three times. His grandmother believes in him.\n• Monique's barrier wasn't motivation — it was childcare. Her mother solved it.\n• Andre got a job and didn't tell anyone. The help that mattered most was invisible even to him.\n• The program doesn't need more curriculum. It needs more Marcus.\n\nThe funder report will say "23 participants enrolled, 8 placed." The Metro Narrative will say: "People are showing up before they're ready, and the ones who stay are finding their way."\n\nCROS™ didn't develop anyone's workforce. The participants did — through showing up scared, trying again, and letting someone walk beside them.\n\nCROS™ just kept the door open.`,
  },
];

export default function MinistryOutreachWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Workforce Development"
      introLine="See how a workforce development program uses CROS™ to walk alongside participants, track employer relationships, and notice the barriers that intake forms miss."
      sections={sections}
      closingReflection="CROS™ didn't develop anyone's workforce. The participants did — through showing up scared, trying again, and letting someone walk beside them. CROS™ just kept the door open."
      slug="ministry-outreach-week"
    />
  );
}
