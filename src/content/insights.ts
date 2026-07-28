/**
 * Insights content registry — narrative essays for /insights/[slug].
 *
 * WHAT: Static insight entries rendered as long-form pages.
 * WHERE: Imported by InsightPage.tsx and the sitemap generator.
 * WHY: SEO-rich narrative content that links into archetypes, roles, and pricing.
 */

export interface Insight {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  datePublished: string;
  suggestedArchetype?: string;
  suggestedRole?: 'shepherd' | 'companion' | 'visitor';
  body: string[];
  closing?: string;
}

export const insights: Insight[] = [
  {
    slug: 'why-crm-fails-nonprofits',
    title: 'Why Traditional CRMs Fail Mission-Driven Organizations',
    description: 'Sales pipelines were never designed for community work. Here is what happens when nonprofits try to force-fit CRM tools and what to do instead.',
    keywords: ['nonprofit CRM', 'CRM alternative', 'community relationship management'],
    datePublished: '2026-01-15',
    suggestedArchetype: 'digital_inclusion',
    suggestedRole: 'shepherd',
    body: [
      'For decades, nonprofits have been told that a CRM will solve their organizational challenges. Invest in the right system, track your contacts, build your pipeline - and growth will follow.',
      'But pipelines were designed for sales. They measure progression toward a transaction. Mission-driven organizations do not operate that way. Their "pipeline" is a web of trust, presence, and care that cannot be reduced to stages and close dates.',
      'When a church adopts a sales CRM, the pastor becomes a "sales rep." When a digital inclusion nonprofit tracks "leads," they lose sight of the human behind the data point.',
      'CROS was built for a different reality. Instead of pipelines, it offers journey chapters. Instead of lead scores, it offers reflections. Instead of conversion metrics, it offers narrative intelligence - the quiet awareness that emerges when you pay attention to people over time.',
      'The question is not whether you need technology. It is whether your technology remembers why you started.',
    ],
    closing: 'Technology should support presence, not replace it.',
  },
  {
    slug: 'relationship-memory-matters',
    title: 'Relationship Memory: Why Organizations Forget the People They Serve',
    description: 'Staff turnover, scattered notes, and lost context. Relationship memory is the invisible infrastructure that mission teams cannot afford to lose.',
    keywords: ['relationship memory', 'institutional knowledge', 'community care'],
    datePublished: '2026-02-01',
    suggestedArchetype: 'church',
    suggestedRole: 'companion',
    body: [
      'Every organization has a memory problem. Not a data problem - a memory problem.',
      'When a case worker leaves, they take years of context with them. When a pastor retires, the relational threads they held together quietly unravel. When a volunteer coordinator moves on, the subtle knowledge of who shows up, who needs encouragement, and who is quietly struggling disappears.',
      'This is not a database issue. It is a human issue. And it requires a human solution.',
      'CROS builds relationship memory through reflections - private notes that capture what matters in a conversation, a visit, or a moment. Over time, these reflections create a living record that belongs to the organization, not just the individual.',
      'NRI connects these reflections to journeys, community signals, and team patterns. The result is not a report - it is awareness. The kind of awareness that lets a new team member pick up a relationship where the last person left off.',
    ],
    closing: 'Memory is not data. Memory is care, preserved.',
  },
  {
    slug: 'community-awareness-not-analytics',
    title: 'Community Awareness Is Not Analytics',
    description: 'Dashboards track what happened. Community awareness notices what is changing. The difference matters for organizations that serve people.',
    keywords: ['community awareness', 'local pulse', 'community signals', 'narrative intelligence'],
    datePublished: '2026-02-10',
    suggestedArchetype: 'workforce',
    suggestedRole: 'shepherd',
    body: [
      'Analytics tell you what happened. Community awareness tells you what is shifting.',
      'A dashboard can show that event attendance dropped 15% this quarter. But it cannot tell you that a new family shelter opened three blocks from your church. It cannot notice that two separate team members mentioned the same neighborhood in their reflections this week.',
      'Community awareness is the practice of noticing - not measuring. It is the difference between tracking a metric and understanding a moment.',
      'CROS builds community awareness through Signum, its signal intelligence layer. Signum monitors local news, community events, and trusted sources, then surfaces relevant changes alongside your team reflections and relationship data.',
      'The result is not a chart. It is a paragraph - a Metro Narrative that reads like a letter from someone who has been paying attention.',
    ],
    closing: 'Awareness begins with noticing. CROS helps you notice.',
  },
  {
    slug: 'voice-of-the-visitor',
    title: 'The Voice of the Visitor: Field Notes Without Forms',
    description: 'Most field teams are forced to choose between being present and documenting their work. Voice notes change that equation.',
    keywords: ['field notes', 'voice notes', 'mobile CRM', 'visitor role', 'community outreach'],
    datePublished: '2026-02-18',
    suggestedArchetype: 'church',
    suggestedRole: 'visitor',
    body: [
      'The Visitor walks into a hospital room, a community center, a family kitchen. Their phone is in their pocket. Their attention is on the person in front of them.',
      'After the conversation, they step outside and tap a single button. Thirty seconds of voice. A name, a feeling, a follow-up. Done.',
      'Most CRMs were designed for people sitting at desks. Forms, dropdowns, required fields. But the most important relationship work happens standing up - in hallways, parking lots, and living rooms.',
      'CROS Visitor mode strips away everything that does not serve presence. No typing required. No forms. Just a microphone and a moment of reflection.',
      'The voice note becomes a transcribed activity. NRI can reference it later. The Shepherd sees it in the Metro Narrative. But the Visitor never had to stop being human to make it happen.',
    ],
    closing: 'The best documentation happens when you forget you are documenting.',
  },
  {
    slug: 'shepherds-and-systems',
    title: 'What Shepherds Need From Technology',
    description: 'Leaders of mission-driven organizations need calm awareness, not urgent dashboards. Here is how CROS serves the Shepherd role.',
    keywords: ['shepherd role', 'nonprofit leadership', 'calm dashboard', 'narrative overview'],
    datePublished: '2026-02-20',
    suggestedArchetype: 'social_enterprise',
    suggestedRole: 'shepherd',
    body: [
      'A Shepherd does not need more alerts. They need awareness.',
      'The difference is everything. An alert demands immediate action. Awareness creates space for thoughtful response. One creates pressure. The other creates clarity.',
      'Most technology platforms are built for urgency. Red badges. Notification counts. Overdue task lists. These tools assume that the most important thing is always the most recent thing.',
      'But a Shepherd knows better. The most important thing might be a relationship that has been quietly drifting for six months. A community shift that will not show up in quarterly metrics. A team member who needs encouragement, not another task.',
      'CROS gives Shepherds a narrative overview - not a dashboard. The Metro Narrative reads like a letter from a thoughtful colleague. Drift Detection surfaces patterns, not emergencies. Journey chapters show arcs, not data points.',
      'The goal is not to make leaders faster. It is to make them wiser.',
    ],
    closing: 'Wisdom requires space. CROS creates it.',
  },
];
