/**
 * Role Stories — Narrative stories anchored to specific roles at /stories/roles/:slug.
 *
 * WHAT: Hypothetical but realistic stories showing a single role in action.
 * WHERE: /stories/roles/:slug
 * WHY: SEO authority through role-centered narrative content.
 */

export interface RoleStory {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  datePublished: string;
  role: 'shepherd' | 'companion' | 'visitor';
  opening: string;
  timeline: { time: string; title: string; narrative: string; feature?: string }[];
  reflection: string;
  closing: string;
}

export const roleStories: RoleStory[] = [
  {
    slug: 'visitor-home-visit',
    title: 'A Visitor\'s Morning',
    description: 'What it feels like to make a home visit with CROS™ — from checking assignments to recording a voice note in the car.',
    keywords: ['visitor story', 'home visit', 'voice notes', 'field work', 'CROS visitor'],
    datePublished: '2026-02-19',
    role: 'visitor',
    opening: 'James is a volunteer at Grace Community Church. Every Tuesday morning, he visits two or three families. He doesn\'t think of himself as a "data collector" or a "case worker." He\'s just a neighbor who shows up.',
    timeline: [
      {
        time: '8:15 AM',
        title: 'Checking the list',
        narrative: 'James opens CROS™ on his phone while finishing coffee. Two visits today: the Ramirez family and Mrs. Chen. For the Ramirezes, his Shepherd left a note: "Carlos mentioned looking for work last time." For Mrs. Chen: "She loves when people stay for tea."',
        feature: 'Visit Assignments',
      },
      {
        time: '9:00 AM',
        title: 'At the Ramirez home',
        narrative: 'Carlos opens the door with a smile. The kids are at school. They talk for twenty minutes — about work, about the neighborhood, about his mother visiting from Guatemala. James notices a stack of unpaid envelopes on the counter but doesn\'t mention it. He just notices.',
      },
      {
        time: '9:30 AM',
        title: 'The voice note',
        narrative: 'Walking to his car, James taps the microphone: "Visited Carlos. He\'s in better spirits. Still looking for work — asked about the job fair at the library. Noticed some financial stress. Kids are thriving." Thirty seconds. Done.',
        feature: 'Voice Notes',
      },
      {
        time: '10:15 AM',
        title: 'Tea with Mrs. Chen',
        narrative: 'Mrs. Chen has been alone since her husband passed. She doesn\'t need services — she needs someone to sit with her. James stays for forty-five minutes. They look at photos. She tells him about her garden. When he leaves, she squeezes his hand.',
      },
      {
        time: '11:00 AM',
        title: 'The second voice note',
        narrative: '"Visited Mrs. Chen. She\'s doing well — lonely but strong. Showed me photos of her granddaughter in Seattle. Garden is coming back. She asked if anyone from the church could help with the fence." Another thirty seconds.',
        feature: 'Voice Notes',
      },
    ],
    reflection: 'James doesn\'t know that his voice notes will appear in Pastor Beth\'s Metro Narrative on Monday morning. He doesn\'t know that NRI™ will gently flag Mrs. Chen\'s fence request. He doesn\'t need to know. His job was to show up — and he did.',
    closing: 'The most important technology in CROS™ is the one you barely notice. It remembers what you witnessed — so the story of every person you visited is never lost.',
  },
  {
    slug: 'shepherd-followup',
    title: 'A Shepherd\'s Monday Morning',
    description: 'How a Shepherd starts the week — reviewing the Metro Narrative, noticing drift signals, and deciding who needs a call.',
    keywords: ['shepherd story', 'metro narrative', 'leadership', 'pastoral care', 'CROS shepherd'],
    datePublished: '2026-02-19',
    role: 'shepherd',
    opening: 'Pastor Beth arrives at her office at 7:30. Before opening email, she opens CROS™. The Metro Narrative is waiting — a short letter about her community\'s week.',
    timeline: [
      {
        time: '7:35 AM',
        title: 'The Weekly Narrative',
        narrative: 'The narrative reads: "Three families were visited this week. The Ramirez family is stabilizing — Carlos is pursuing a job lead. Mrs. Chen requested help with her fence. Two new families attended Sunday service. Volunteer hours are up 15% from last month."',
        feature: 'Metro Narrative',
      },
      {
        time: '7:45 AM',
        title: 'A drift signal',
        narrative: 'Testimonium shows a gentle flag: "David Martinez has not been active in three weeks — previously one of your most engaged volunteers." Not an alarm. Just a notice. Beth makes a mental note to call him today.',
        feature: 'Testimonium',
      },
      {
        time: '8:00 AM',
        title: 'A community signal',
        narrative: 'Signum has surfaced a local news item: "City council approves new affordable housing development on Elm Street — 200 units planned." Beth adds a Reflection: "This could change the character of the Elm Street neighborhood. We should connect with the developers early."',
        feature: 'Signum',
      },
      {
        time: '8:15 AM',
        title: 'The phone call',
        narrative: 'Beth calls David. He\'s fine — just dealing with his mother\'s health. "I\'ll be back next month," he says. Beth adds a brief Reflection: "David\'s mother is ill. Give him space. Check in again in two weeks."',
        feature: 'Reflections',
      },
    ],
    reflection: 'In thirty minutes, Beth has absorbed the story of her community\'s week, noticed someone who needed care, and connected a local development to her mission. No dashboard. No KPIs. Just awareness.',
    closing: 'A Shepherd doesn\'t manage people — a Shepherd holds the story. CROS™ helps you hold it gently, without the weight of a spreadsheet.',
  },
  {
    slug: 'companion-delivery-day',
    title: 'A Companion\'s Delivery Day',
    description: 'How a Companion uses CROS™ to deliver devices, capture reflections, and keep the thread of care alive.',
    keywords: ['companion story', 'digital inclusion', 'device delivery', 'relationship care', 'CROS companion'],
    datePublished: '2026-02-19',
    role: 'companion',
    opening: 'Marcus is a tech coordinator at Harbor Digital Inclusion. Today he\'s delivering three refurbished laptops. Each one represents a family\'s request for connection.',
    timeline: [
      {
        time: '9:00 AM',
        title: 'Checking provisions',
        narrative: 'Marcus opens Prōvīsiō in CROS™. Three deliveries today: Garcia family (Chromebook, Spanish setup), Thompson household (laptop for remote work), and the Eastside Community Center (two monitors). Each has a note from his Shepherd.',
        feature: 'Prōvīsiō',
      },
      {
        time: '10:00 AM',
        title: 'The Garcia delivery',
        narrative: 'Mrs. Garcia opens the door cautiously. Her daughter translates. Marcus sets up the Chromebook, connects Wi-Fi, and shows Mrs. Garcia how to open email. She types her first email to her sister in Puebla. She cries a little.',
      },
      {
        time: '10:30 AM',
        title: 'The reflection',
        narrative: 'Marcus writes a quick Reflection: "Delivered Chromebook to Garcia family. Set up Wi-Fi and email. Mrs. Garcia sent her first email to her sister — emotional moment. Daughter Isabella is tech-savvy and can help going forward."',
        feature: 'Reflections',
      },
      {
        time: '11:30 AM',
        title: 'The Thompson delivery',
        narrative: 'Mr. Thompson needs the laptop for a remote job interview next week. Marcus sets it up with a webcam test. They practice a mock video call. Thompson is nervous but grateful.',
        feature: 'Prōvīsiō',
      },
      {
        time: '1:00 PM',
        title: 'Community Center monitors',
        narrative: 'At the Eastside Center, Marcus installs two monitors in the computer lab. The director mentions interest in a coding class for teens. Marcus logs this in his Reflection and tags it for his Shepherd.',
        feature: 'Reflections',
      },
    ],
    reflection: 'By the end of the day, Marcus has delivered three pieces of technology. But more importantly, he\'s deepened three relationships. The Garcia family trusts him more. Thompson has a shot at a job. The community center is expanding its vision. These aren\'t transactions — they\'re threads in a story.',
    closing: 'A Companion keeps the thread. Not with project management tools — with presence, follow-through, and the quiet confidence that comes from knowing you\'ll remember.',
  },
];
