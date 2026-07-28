import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'The First Week After',
    narrative: `Nadira coordinates resettlement services for a refugee support agency. Fourteen families arrived in the metro area last quarter. Six more are expected by spring.\n\nMonday morning, she opens CROS™ with a cup of tea and reads the Metro Narrative.\n\nOver the weekend, a Companion named Yusuf logged a Reflection about the Hassan family: "Helped Ibrahim fill out his work permit application. He's anxious — keeps asking how long it will take. His wife Sahra is adjusting better. She found the halal grocery store on her own."\n\nNadira reads it carefully. She's learned that the small details — finding a grocery store, learning a bus route — matter more than any case milestone. She types a note in the Hassan family Journey: "Sahra is navigating independently. Ibrahim needs reassurance on timeline. Follow up Wednesday."`,
  },
  {
    day: 'Tuesday',
    title: 'Companions Across the City',
    narrative: `Three Companions are active today, each working with different families.\n\nYusuf is helping the Hassans navigate the school enrollment process for their two children. He logs: "Met with the school counselor. She was kind. Kids will start next Monday. Ibrahim asked me to come with them on the first day."\n\nLena is working with Mrs. Nguyen, an elderly Vietnamese woman who arrived alone through family reunification. Lena writes: "Took her to the pharmacy. She has three prescriptions but couldn't read the labels. We need to arrange translation for her medication schedule."\n\nCarlos is running a group orientation for two newly arrived families from Guatemala. He uses the quick-add: "Orientation complete. Both families need winter coats — kids especially. One father, Diego, asked about ESL classes."\n\nNone of them see each other's Reflections. But the system quietly holds the full picture — fourteen families, each with their own story, all arriving in the same city at the same time.`,
  },
  {
    day: 'Wednesday',
    title: 'The Home Visit',
    narrative: `Nadira visits the Hassan family.\n\nThe apartment is sparse — donated furniture, a prayer rug in the corner, children's drawings taped to the refrigerator. Sahra has made tea. Ibrahim is quiet.\n\nThey talk for an hour. Not about forms or deadlines — about what they miss, what confuses them, what they hope for. Ibrahim says he was an electrician in Aleppo. He wants to work.\n\nAfterward, Nadira sits in her car and records a voice note: "Visited the Hassans. Apartment is modest but they're making it home. Ibrahim's skills — electrician background — could be a pathway. Need to connect with the workforce center. Sahra is the steady one in this family."\n\nThe voice note becomes a Visit activity. The mention of electrician skills surfaces later in the Journey as a quiet thread — not a task, but a possibility worth remembering.`,
  },
  {
    day: 'Thursday',
    title: 'Patterns Across Families',
    narrative: `The weekly rhythm runs quietly across the agency's network.\n\nA pattern emerges:\n• Three families this month have asked about ESL classes — the current provider has a two-month waitlist.\n• Two Companions mentioned winter clothing needs independently.\n• Mrs. Nguyen's medication translation issue is not unique — Lena noted a similar problem with another family last month.\n• School enrollment is going smoothly, but two families expressed anxiety about the first day.\n\nThe Metro Narrative gathers this gently:\n\n"This week, your network showed signs of settling in. Families are asking about language learning and work — signs of readiness. Two practical needs recur: winter clothing and medication translation. School enrollment is proceeding, carried by Companion presence on difficult first days."\n\nNadira reads this and sees what a case management system would miss: these families are not cases. They are people finding their footing, and the patterns reveal shared needs that deserve shared solutions.`,
  },
  {
    day: 'Friday',
    title: 'Community Signals',
    narrative: `Signum picks up two items from the local feed.\n\nFirst: a mosque in the metro area is hosting a welcome dinner for refugee families next Saturday. It's tagged with the agency's community keywords: "refugee," "welcome," "community gathering."\n\nSecond: a local employer — an electrical contractor — posted about hiring apprentices. No experience required. Training provided.\n\nNadira sees the welcome dinner and shares it with Yusuf: "The Hassans might appreciate this. Low pressure, familiar setting."\n\nShe sees the apprenticeship posting and her mind goes to Ibrahim. She doesn't apply on his behalf — that's his choice. But she adds a note to his Journey: "Electrical apprenticeship posted — Martinez & Sons. Worth mentioning when he's ready."\n\nThe system didn't tell her what to do. It put two things next to each other and let her make the connection.`,
  },
  {
    day: 'Saturday',
    title: 'The Clothing Drive',
    narrative: `Saturday morning, Carlos organizes a winter clothing drive at the agency's community room. Word spread through the Companions — the two independent mentions of winter coat needs became a shared response without anyone writing a memo.\n\nSeven families come. Children try on coats. Diego — the father from Guatemala — helps organize the donation boxes. He's quiet but steady. Carlos logs a Reflection: "Diego volunteered without being asked. He sorted everything by size. He wants to be useful."\n\nDrift Detection notes that one family — the Tran family — hasn't been contacted in three weeks. It says gently: "You might want to check in with the Trans — they've been quiet lately."\n\nNadira asks Lena to call. The Trans are fine — Mrs. Tran found a part-time job at a nail salon. She didn't tell anyone because she wasn't sure if it would affect their benefits. Lena helps her understand the rules.\n\nNo crisis. Just a question that needed a safe person to ask.`,
  },
  {
    day: 'Sunday',
    title: 'What Resettlement Really Looks Like',
    narrative: `Sunday is rest. But the week held an entire world.\n\nNadira knows things no intake form could contain:\n\n• Ibrahim was an electrician, and there's an apprenticeship three miles from his apartment.\n• Sahra found the grocery store on her own — a small victory that signals confidence.\n• Mrs. Nguyen can't read her medication labels, and she's not the only one.\n• Diego sorted coats without being asked, because helping is how he steadies himself.\n• The Trans are doing better than anyone knew — Mrs. Tran just needed someone to ask.\n• Two children start school Monday, and a Companion will be there with them.\n\nThe case file says "14 families in active resettlement." The Metro Narrative says something more human: "People are arriving, settling, and beginning to help each other."\n\nCROS™ didn't resettle anyone. The families did — with courage, patience, and the steady presence of people who showed up.\n\nCROS™ just remembered their names.`,
  },
];

export default function CommunityNetworkWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Refugee Support Organization"
      introLine="See how a refugee resettlement team uses CROS™ to hold family stories, notice shared needs, and walk alongside people rebuilding their lives."
      sections={sections}
      closingReflection="CROS™ didn't resettle anyone. The families did — with courage, patience, and the steady presence of people who showed up. CROS™ just remembered their names."
      slug="community-network-week"
    />
  );
}
