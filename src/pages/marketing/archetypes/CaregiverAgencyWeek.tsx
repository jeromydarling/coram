import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'The Week Ahead',
    narrative: `The care coordinator opens CROS™ Monday morning. Twelve caregivers are active this week across the metro.\n\nNo surveillance dashboard. No productivity scores. Just a gentle overview of care patterns.\n\nNRI notices that three caregivers independently mentioned Mrs. Patterson seeming "more tired than usual" in their visit notes last week. It doesn't escalate this. It surfaces it as a quiet signal: "Multiple caregivers have noted fatigue patterns with Mrs. Patterson."\n\nThe coordinator makes a note to discuss it at Wednesday's team huddle — not as a performance review, but as a care conversation.`,
  },
  {
    day: 'Tuesday',
    title: 'Companions in the Field',
    narrative: `Sarah visits the Rodriguez family. She logs a quick voice note after:\n\n"Mr. Rodriguez is adjusting to the new medication schedule. His wife seems overwhelmed — she asked about respite care options again. The grandkids were there today, which helped his mood."\n\nMeanwhile, James checks in on two clients in the same neighborhood. He notices a pattern: both mentioned difficulty getting to pharmacy pickups since the bus route changed.\n\nNeither Sarah nor James sees each other's notes. Privacy is preserved. But the coordinator can see that transportation came up twice this week — a signal worth watching.`,
  },
  {
    day: 'Wednesday',
    title: 'Team Huddle',
    narrative: `The weekly team huddle isn't a status report. It's a care conversation.\n\nThe coordinator shares what CROS™ surfaced — not raw notes, never raw notes — but patterns:\n\n"Three of you noticed Mrs. Patterson seems more fatigued. Has anything changed in her routine?"\n\nOne caregiver mentions she stopped going to her morning walking group. Another noticed new medication bottles on the counter.\n\nThe team decides to gently explore this with her family. No alarm. Just attentive care.\n\nThis is what dignified visibility looks like — the agency sees patterns without reading private moments.`,
  },
  {
    day: 'Thursday',
    title: 'Care Rhythm Review',
    narrative: `The coordinator reviews the weekly Care Rhythm:\n\n• Visit frequency is steady across all clients.\n• Two caregivers flagged transportation as a barrier — same neighborhood.\n• Mrs. Patterson's fatigue pattern is now documented across three independent observations.\n• New client intake for Mr. Kim is scheduled for next Monday.\n\nThe Rhythm doesn't rank caregivers. It doesn't calculate efficiency. It tells a story about how care is flowing — where it's steady, where it might need attention.\n\nThe coordinator uses this to plan next week's assignments with awareness, not metrics.`,
  },
  {
    day: 'Friday',
    title: 'Onboarding a New Caregiver',
    narrative: `A new caregiver, Maria, starts orientation.\n\nInstead of handing her a stack of client files, the coordinator walks her through CROS™:\n\n"This is where you'll log your visit notes — voice or text. These are your people. You'll build their stories over time. Nobody reads your reflections but you. The agency sees patterns, not words."\n\nMaria asks: "What if I notice something concerning?"\n\n"Write it down honestly. If the same concern shows up from different caregivers, the system gently surfaces it. You're not reporting — you're noticing."`,
  },
  {
    day: 'Saturday',
    title: 'Quiet Signals',
    narrative: `The system runs its weekend rhythm quietly.\n\nDrift Detection notices one client hasn't had a visit logged in 12 days — longer than the agreed care plan cadence. It surfaces this for Monday's review.\n\nSignum picks up a local news item: the county is expanding its respite care voucher program. This appears in the coordinator's feed, tagged because "respite care" matches a keyword from this week's caregiver notes.\n\nNo one needs to act today. The signals will be there Monday.`,
  },
  {
    day: 'Sunday',
    title: 'The Agency That Remembers',
    narrative: `Most care agencies track hours and tasks. They know who was where and for how long.\n\nBut CROS™ helps this agency remember something different:\n\n• Mrs. Patterson might be declining — noticed by the people closest to her, not a checklist.\n• A bus route change is affecting pharmacy access in the west side.\n• Mr. Rodriguez's wife needs respite — and a new program might help.\n• A new caregiver just learned that her job is to notice, not to report.\n\nThe caregivers created this knowledge. CROS™ just made sure the agency could honor it without invading it.`,
  },
];

export default function CaregiverAgencyWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Caregiver Agency"
      introLine="See how a home care agency uses CROS™ to support caregivers, notice care patterns, and maintain dignified visibility — without surveillance."
      sections={sections}
      closingReflection="CROS™ didn't provide the care. The caregivers did — through patience, presence, and honest noticing. CROS™ just helped the agency honor their work."
      slug="caregiver-agency-week"
    />
  );
}
