import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'Quiet Beginning',
    narrative: `The week starts simply. You open CROS™ with your morning coffee.\n\nNo inbox flood. No supervisor dashboard. Just your people — the ones you're walking with.\n\nNRI notices you haven't visited Mrs. Chen in nine days. It doesn't flash red. It simply says: "It's been a little while since you saw Mrs. Chen. She mentioned her garden last time."\n\nYou make a note: "Visit Wednesday afternoon." That's it. The system remembers so you don't have to carry it all in your head.`,
  },
  {
    day: 'Tuesday',
    title: 'Care in Motion',
    narrative: `You visit Mr. Howard. He's recovering from a fall. His daughter Angela called last week, worried.\n\nAfter the visit, you open your phone and tap the microphone:\n\n"Mr. Howard is doing better. Walking with a cane now. He asked about his dog — Angela has been taking care of Max. He misses the routine of feeding him in the morning."\n\nThe voice note is transcribed. It becomes part of his story. No forms. No clinical language. Just what you noticed.`,
  },
  {
    day: 'Wednesday',
    title: 'Garden Conversation',
    narrative: `You visit Mrs. Chen. She's in her garden, which surprises you — last month she barely left the living room.\n\nShe shows you the tomatoes she planted. She talks about her late husband, how he always grew too many. She laughs.\n\nYou write a Reflection later: "Mrs. Chen is finding her way back to things that matter. The garden is a bridge. She mentioned wanting to give tomatoes to the neighbor — first social impulse in months."\n\nThis reflection is private. No agency sees it. No report includes it. It's yours and hers.`,
  },
  {
    day: 'Thursday',
    title: 'Noticing Patterns',
    narrative: `NRI runs its quiet weekly rhythm.\n\nIt notices:\n• Mrs. Chen's mood has shifted positively over three visits.\n• Mr. Howard mentioned routine disruption twice — feeding the dog, morning walks.\n• You haven't logged a reflection for David in two weeks.\n\nThe Metro Narrative doesn't exist for solo caregivers. Instead, you see a Care Rhythm summary:\n\n"This week, you're seeing gentle progress with Mrs. Chen and steady recovery with Mr. Howard. David may need a check-in — it's been quiet there."\n\nIt takes 30 seconds to read. It tells you what your notebook would, if your notebook could think.`,
  },
  {
    day: 'Friday',
    title: 'A Difficult Call',
    narrative: `Angela calls about Mr. Howard. She's considering moving him to assisted living. She asks what you think.\n\nYou open Mr. Howard's Journey in CROS™. You can see:\n• His fall was six weeks ago.\n• He's been making steady progress.\n• He mentioned wanting to feed Max again — a sign of returning independence.\n• Last week he walked to the mailbox for the first time.\n\nYou don't make the decision. But you have something better than an opinion — you have a story. You share what you've noticed, gently.\n\nAngela pauses. "I didn't know about the mailbox," she says.`,
  },
  {
    day: 'Saturday',
    title: 'Rest',
    narrative: `Saturday is yours. CROS™ doesn't send notifications. There are no urgent badges.\n\nDrift Detection quietly notes that David hasn't had a visit in 16 days. It doesn't say "WARNING." It says: "You might want to check in with David when you're ready."\n\nYou make a mental note for Monday. Then you close the app and go for a walk.`,
  },
  {
    day: 'Sunday',
    title: 'The Thread You Hold',
    narrative: `Caregiving is invisible work. No one sees most of what you do.\n\nBut CROS™ holds the thread:\n\n• Mrs. Chen is returning to life through her garden.\n• Mr. Howard is closer to independence than his family realized.\n• David needs gentle attention.\n\nYou didn't create any of this progress. They did — through resilience, humor, and small daily acts.\n\nYou just showed up. And CROS™ remembered.`,
  },
];

export default function CaregiverSoloWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Caregiver (Solo)"
      introLine="See how an independent caregiver uses CROS™ to hold care stories, notice patterns, and stay present — without paperwork or surveillance."
      sections={sections}
      closingReflection="CROS™ didn't provide the care. You did — through showing up, listening, and holding space. CROS™ just made sure nothing was forgotten."
      slug="caregiver-solo-week"
    />
  );
}
