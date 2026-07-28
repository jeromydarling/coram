import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'Quiet Follow-Up',
    narrative: `The weekend was full — two services, a baptism, a family who showed up for the first time in months. Now it's Monday morning and the Shepherd opens CROS™ with a cup of coffee.\n\nNo inbox explosion. No task avalanche. Just a quiet list of moments worth remembering.\n\nNRI noticed that the Garza family attended both services — something it gently flags because they've been absent for six weeks. There's a Reflection from last month where the Shepherd wrote: "Luis mentioned stress at work. Maria seemed withdrawn."\n\nThere's no alarm. No red badge. Just a soft suggestion: "You may want to reach out to the Garzas. It's been a while."\n\nThe Shepherd types a quick note — "Will call Luis Tuesday evening" — and moves on. Nothing urgent. Just faithful attention.`,
  },
  {
    day: 'Tuesday',
    title: 'Companions in Motion',
    narrative: `Two Companions are active today.\n\nSarah, who leads the women's Bible study, logs a Reflection after her morning group: "Three new women joined today. One of them, Denise, recently moved from Houston. She seemed nervous but stayed for coffee after."\n\nMeanwhile, Marcus is running the food pantry prep. He doesn't write paragraphs — he uses the quick-add on his phone: "42 boxes packed. Need more canned vegetables next week. Spoke with Mr. Howard — he's recovering from knee surgery."\n\nNeither Sarah nor Marcus sees each other's notes. That's by design. CROS™ keeps Reflections scoped to the person who wrote them. But NRI quietly notices the overlap: both mentioned newcomers this week. It stores this as a signal — not an alert. A thread the Shepherd might see later in the Metro Narrative.`,
  },
  {
    day: 'Wednesday',
    title: 'Visitor Voice Notes',
    narrative: `Pastor James makes a hospital visit. He's 67. He doesn't want to type on a small screen in a hospital hallway.\n\nSo he opens CROS™ on his phone and taps the microphone.\n\n"Visited Brother Thomas at Memorial. He's in good spirits. Hip replacement went well. Wants someone to bring his Bible — the brown one from his office. Daughter Angela is flying in Thursday."\n\nThat's it. The voice note is transcribed. It becomes a Visit Note activity. NRI can later reference it — "Brother Thomas was visited on Wednesday. Recovery noted as positive."\n\nPastor James puts his phone away and sits with Brother Thomas for another hour. No forms. No checkboxes. Just showing up.`,
  },
  {
    day: 'Thursday',
    title: 'The Nervous System at Work',
    narrative: `NRI runs its quiet weekly rhythm.\n\nIt notices:\n• The Garza family re-engaged after a six-week gap.\n• Two newcomers were mentioned by different Companions.\n• Brother Thomas's visit was logged.\n• The food pantry mentioned a supply gap.\n\nNone of these become "tasks." They become part of the Metro Narrative — a living paragraph that reads like a pastoral letter:\n\n"This week, your community showed signs of gentle re-engagement. The Garzas returned after an absence. Two new faces appeared in the women's study. A faithful member is recovering well. Your food ministry may need restocking before the weekend."\n\nThe Shepherd reads this Thursday evening. It takes 90 seconds. It tells a story no spreadsheet could.`,
  },
  {
    day: 'Friday',
    title: 'Community Signals',
    narrative: `CROS™'s Signum layer picks up a local news item: "City announces new family shelter opening on Oak Street — three blocks from the church."\n\nIt doesn't push this as an alert. It appears in the Local Pulse feed, tagged with the church's community keywords: "shelter," "family services," "neighborhood."\n\nThe Shepherd sees it and thinks: "We should invite the shelter director to our community dinner next month." She adds a note to the Journey of a new Opportunity — not a sales lead, but a potential partnership.\n\nNo one told her to do this. The system simply noticed.`,
  },
  {
    day: 'Saturday',
    title: 'Calm Mode',
    narrative: `Saturday is prep day. The Shepherd glances at CROS™ one more time.\n\nThe Drift Detection quietly shows that two longtime volunteers haven't logged hours in three weeks. It doesn't say "WARNING." It says: "You might want to check in with David and Rosa — they've been quiet lately."\n\nShe texts David. He's been dealing with a family matter. She prays for him and moves on.\n\nRosa, it turns out, is fine — just busy with grandkids. She'll be back next week.\n\nNo crisis. Just care.`,
  },
  {
    day: 'Sunday',
    title: 'The Living Story',
    narrative: `The week comes full circle.\n\nAs the congregation gathers, the Shepherd knows things no attendance sheet could tell her:\n\n• The Garzas are back and need warmth, not questions.\n• Denise is new and might need a follow-up coffee.\n• Brother Thomas wants his Bible brought to the hospital.\n• The food pantry needs canned vegetables.\n• A new shelter is opening nearby.\n• David needs prayer. Rosa needs patience.\n\nCROS™ didn't create any of this knowledge. The people did — through showing up, reflecting, and caring.\n\nCROS™ just remembered.`,
  },
];

export default function ChurchWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Church / Faith Community"
      introLine="See how a church team uses CROS across a typical week - from Monday follow-ups to Sunday morning, without spreadsheets or urgency."
      sections={sections}
      closingReflection="CROS did not create any of this knowledge. The people did - through showing up, reflecting, and caring. CROS just remembered."
      slug="church-week"
    />
  );
}
