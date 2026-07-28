import ArchetypeWeekTemplate, { type WeekDay } from '@/components/marketing/ArchetypeWeekTemplate';

const sections: WeekDay[] = [
  {
    day: 'Monday',
    title: 'Revenue and Roots',
    narrative: `Tomás runs a social enterprise that employs refugee women to make artisan soaps. Twelve employees. Three retail partners. One mission: dignified work for people rebuilding their lives.\n\nMonday morning, he opens CROS™ — not a sales dashboard. He starts with the Metro Narrative.\n\nOver the weekend, one of his retail partners — a boutique downtown called The Olive Branch — posted on social media about their best-selling product: his team's lavender soap. A Companion who manages that account logged a Reflection: "Owner mentioned they're expanding to a second location in March. Asked if we could increase volume."\n\nTomás doesn't see this as a sales opportunity. He sees it as a question: can his team handle more production without burning out? He opens the Journey for The Olive Branch and types: "Expansion talk. Need to check in with Fatima about production capacity before saying yes."`,
  },
  {
    day: 'Tuesday',
    title: 'The Workshop Floor',
    narrative: `Fatima is the production lead. She's been with the enterprise for three years — the longest of anyone.\n\nTomás visits the workshop. He doesn't bring a clipboard. He brings coffee.\n\nThey talk about the expansion request. Fatima is honest: "We can do it, but not yet. Amira is still learning the curing process. Give us six weeks."\n\nTomás logs a Reflection on his phone: "Fatima says six weeks before we can scale. She's protecting the team's pace. She's right."\n\nHe updates The Olive Branch Journey: "Capacity conversation — team needs six weeks. Will circle back in March. Don't push."\n\nNo one told him to slow down. The Reflection told him what he already knew.`,
  },
  {
    day: 'Wednesday',
    title: 'A Partner Stops By',
    narrative: `Elena, who runs a fair-trade café across the street, stops by the workshop. She's not a customer — she's a neighbor. But she mentions that a local food co-op is looking for locally made products to stock.\n\nTomás creates a new Opportunity in CROS™: "Green Valley Co-op — intro via Elena." He doesn't add revenue projections or pipeline stages. He adds a note: "Elena vouched for us. Relationship-first approach. Visit the co-op before pitching."\n\nHe tags the Opportunity to the metro. If someone else in CROS™'s network is already connected to the co-op, the system might gently surface that later. No pressure. Just awareness.`,
  },
  {
    day: 'Thursday',
    title: 'The Stories Behind the Soap',
    narrative: `Tomás spends Thursday doing something most business owners skip: listening.\n\nHe sits with Amira during her break. She's been quiet lately. She tells him her daughter started school this week — first time in an American classroom. "She came home crying. She said nobody talked to her."\n\nTomás doesn't log this in CROS™. Some things aren't for the system. But he does log a general Reflection later: "Team morale check — some personal stress this week. Be gentle with production expectations."\n\nThis is the line CROS™ respects. Reflections are private. They hold what the person chooses to share. The system never asks for more.\n\nThat evening, NRI's weekly rhythm surfaces a quiet observation: "Production Reflections this month mention pace and capacity more than quality. The team may be approaching a natural growth boundary."`,
  },
  {
    day: 'Friday',
    title: 'Signum at the Market',
    narrative: `Signum picks up a local article: "City launches small business grant program for mission-driven enterprises — applications open March 15."\n\nIt appears in the Local Pulse feed, tagged with the enterprise's keywords: "social enterprise," "small business," "workforce development."\n\nTomás sees it and bookmarks it. He doesn't apply immediately — he wants to talk to his board mentor first. He adds a note to the metro Journey: "Grant opportunity — city program. Deadline March 15. Could fund equipment for expanded production."\n\nHe also sees that a sustainability conference is happening next month in the metro area. He creates an Event and assigns himself: "Might meet the co-op people there. And maybe other makers."\n\nThe system didn't tell him what to do. It showed him what was happening nearby.`,
  },
  {
    day: 'Saturday',
    title: 'Farmers Market Morning',
    narrative: `Saturday is market day. The team sets up their booth at 7 AM.\n\nTomás watches Fatima explain the soap-making process to a customer. She's confident, clear, articulate. Three years ago, she could barely make eye contact with strangers.\n\nHe doesn't say anything. He just watches.\n\nAfter the market, he opens CROS™ and writes: "Fatima owned the booth today. She explained the cold-process method to at least ten people. She's not just a production lead anymore — she's the face of this enterprise."\n\nDrift Detection notes that one retail partner — a gift shop on the north side — hasn't placed an order in two months. It doesn't flag this as a problem. It says: "You might want to check in with Wren & Thistle — it's been a while."\n\nTomás makes a mental note to call them Monday.`,
  },
  {
    day: 'Sunday',
    title: 'The Week in Full',
    narrative: `Sunday is rest. But the week told a story.\n\nTomás knows things no quarterly report could hold:\n\n• The Olive Branch wants to grow, but his team needs six weeks first.\n• A co-op connection came through a neighbor, not a pitch.\n• Amira's daughter is struggling at school, and that matters to everything.\n• Fatima has become something more than an employee — she's a leader.\n• A grant opportunity appeared at exactly the right time.\n• A retail partner has gone quiet, and that's worth a gentle call.\n\nThe business plan says "scale production by Q3." The Metro Narrative says something more honest: "This enterprise is growing at the speed of trust."\n\nCROS™ didn't build this business. Tomás and his team did — through patience, craft, and showing up for each other.\n\nCROS™ just held the thread.`,
  },
];

export default function SocialEnterpriseWeek() {
  return (
    <ArchetypeWeekTemplate
      archetypeTitle="Social Enterprise"
      introLine="See how a mission-driven business uses CROS™ to stay close to community partners, protect team pace, and grow impact without losing the human thread."
      sections={sections}
      closingReflection="CROS™ didn't build this business. The team did — through patience, craft, and showing up for each other. CROS™ just held the thread."
      slug="social-enterprise-week"
    />
  );
}
