import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'Field Updates',
    narrative: `The week begins with a quiet review of field updates from three countries.\n\nThe Shepherd opens CROS™ and sees signals from Guatemala, Kenya, and the Philippines. Not dashboards — stories.\n\nA Companion in Guatemala City logged a Reflection: "Met with Pastor Miguel's network. Three new churches interested in the literacy program. They want to adapt it for Kaqchikel speakers — something we hadn't considered."\n\nIn Nairobi, a Visitor noted: "Water project completion ceremony was attended by the county commissioner. Community trust is growing."\n\nFrom Manila: "Typhoon recovery efforts shifted — families are asking for livelihood support now, not emergency supplies."\n\nThree countries. Three stories. One system that holds them all.`,
  },
  {
    day: 'Tuesday',
    title: 'Partnership Cultivation',
    narrative: `The Shepherd reviews the Journey of a key partnership in Kenya.\n\nThe relationship started 18 months ago with a single meeting. CROS™ shows the thread:\n• First contact at a conference in Nairobi.\n• Three follow-up visits over six months.\n• A shared project proposal drafted in October.\n• Community elders gave their blessing in December.\n• Water project completed last month.\n\nNo CRM could hold this story. It's not a pipeline. It's a relationship that unfolded at the pace of trust.\n\nThe Shepherd writes a note: "Time to discuss phase two — the community is ready, but we should let them lead the conversation."`,
  },
  {
    day: 'Wednesday',
    title: 'Cross-Field Patterns',
    narrative: `NRI notices something the team hadn't seen.\n\nAcross three countries, the same pattern is emerging: communities that started with emergency or infrastructure needs are now asking for education and livelihood support. Guatemala wants literacy. Kenya wants vocational training. The Philippines wants microfinance.\n\nThe system doesn't call this "market demand." It calls it what it is: "Communities are shifting from survival to flourishing. Your teams are being invited into a new chapter."\n\nThe Shepherd shares this observation with field leaders — not as a directive, but as a question: "Are you seeing this too?"`,
  },
  {
    day: 'Thursday',
    title: 'Cultural Sensitivity',
    narrative: `A Companion in Guatemala flags something important.\n\n"The Kaqchikel-speaking communities have a different relationship with written materials. Oral teaching is primary. If we push printed literacy curricula, we'll miss the mark. We need to think about audio and community storytelling formats."\n\nThis Reflection doesn't trigger an alert. It becomes part of the Guatemala territory's narrative — a cultural insight that will shape every future decision about programming there.\n\nCROS™ doesn't standardize across cultures. It remembers that each field is different.`,
  },
  {
    day: 'Friday',
    title: 'Signum Abroad',
    narrative: `Signum picks up two relevant signals.\n\nFirst: a major international NGO is pulling out of the Philippines province where the team works. This could create a vacuum — or an opportunity for local churches to step into the gap.\n\nSecond: Kenya's county government announced new regulations for foreign-operated water systems. The team's project is community-owned, so it's compliant — but the Shepherd notes: "Good that we insisted on local ownership from the start."\n\nThese signals aren't action items. They're context. They help the team understand the ground they're standing on.`,
  },
  {
    day: 'Saturday',
    title: 'Sabbath Rhythm',
    narrative: `Saturday is quiet. Mission work has a sabbath rhythm — or it should.\n\nDrift Detection gently notes that the Manila team hasn't logged field activity in three weeks. It doesn't say "WARNING." It says: "The Philippines field has been quiet. The team may need support — or space."\n\nThe Shepherd knows the typhoon recovery season is exhausting. She sends a brief message: "Thinking of you. No update needed. Just wanted you to know we're here."\n\nSometimes the most important thing a system can do is remind you to be human.`,
  },
  {
    day: 'Sunday',
    title: 'The Longer Story',
    narrative: `Mission work unfolds in years and decades, not sprints.\n\nAs the week closes, the Shepherd holds a view that no quarterly report could capture:\n\n• Communities in three countries are growing beyond survival into flourishing.\n• A Kaqchikel insight could reshape how the organization thinks about literacy everywhere.\n• Local ownership in Kenya proved wise before anyone could have predicted why.\n• A team in Manila needs patience, not productivity.\n\nCROS™ didn't plant any of these seeds. The people in the field did — through faithfulness, cultural humility, and years of showing up.\n\nCROS™ just made sure the longer story didn't get lost in the daily noise.`,
  },
];

export default function MissionaryOrgWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Missionary Organization"
      introLine="See how a cross-cultural mission organization uses CROS™ to hold field stories, notice patterns across countries, and serve with cultural humility."
      sections={sections}
      closingReflection="CROS™ didn't do the mission work. The people in the field did — through years of faithful presence. CROS™ just made sure the longer story didn't get lost."
      slug="missionary-org-week"
    />
  );
}
