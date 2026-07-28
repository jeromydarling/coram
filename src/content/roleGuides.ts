/**
 * Role Guides — Workflow micro-guides for each role.
 *
 * WHAT: Short (400-700 word) action-oriented guides for specific role workflows.
 * WHERE: /roles/:role/:guideSlug
 * WHY: SEO-rich, practical content that helps users see themselves using CROS.
 */

export interface RoleGuide {
  slug: string;
  role: 'shepherd' | 'companion' | 'visitor' | 'steward';
  title: string;
  description: string;
  keywords: string[];
  datePublished: string;
  sections: { heading: string; body: string }[];
}

export const roleGuides: RoleGuide[] = [
  {
    slug: 'home-visits',
    role: 'shepherd',
    title: 'Overseeing Home Visits as a Shepherd',
    description: 'How Shepherds use CROS™ to guide visit assignments, review voice notes, and keep the thread of pastoral care unbroken.',
    keywords: ['shepherd home visits', 'pastoral care', 'visit management', 'CROS shepherd'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'Why Shepherds oversee visits',
        body: 'Home visits are where the deepest relationships form. As a Shepherd, you don\'t make every visit — but you hold the story of every family. CROS™ gives you a quiet window into what your Visitors are experiencing, without requiring them to fill out forms or write reports.',
      },
      {
        heading: 'Reviewing voice notes',
        body: 'When a Visitor records a voice note after a home visit, NRI™ transcribes it and gently extracts key signals: a health concern mentioned, a family milestone, a need for follow-up. You\'ll see these in your Metro Narrative — woven into the weekly story of your community.',
      },
      {
        heading: 'Assigning visits',
        body: 'Visit assignments are simple. Open the Visits view, select a person or family, and assign a Visitor. You can add a brief note: "Ask about the new baby" or "Bring the Spanish Bible." The Visitor sees this on their mobile screen — nothing more.',
      },
      {
        heading: 'Noticing patterns',
        body: 'Over time, Testimonium surfaces gentle patterns: "The Martinez family has been visited three times this month — more than usual." or "No one has visited Mrs. Chen in six weeks." These aren\'t alerts. They\'re awareness. You decide what to do with them.',
      },
    ],
  },
  {
    slug: 'voice-notes',
    role: 'visitor',
    title: 'Recording Voice Notes as a Visitor',
    description: 'The simplest way to document a visit. Tap, speak, done. Your voice becomes the record.',
    keywords: ['visitor voice notes', 'field recording', 'mobile CRM', 'CROS visitor'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'Why voice notes matter',
        body: 'You just spent thirty minutes with someone. You noticed things — a child\'s new drawing on the fridge, a worried look when rent was mentioned, a moment of laughter about a shared memory. These details matter. But typing them into a form on your phone while standing on a porch? That\'s not realistic.',
      },
      {
        heading: 'How it works',
        body: 'Open CROS™ on your phone. Tap the microphone button. Speak naturally: "Visited the Johnsons. Kids are doing well in school. Marcus mentioned he\'s looking for part-time work. Maria asked about the food pantry schedule." Tap stop. That\'s it.',
      },
      {
        heading: 'What happens next',
        body: 'NRI™ transcribes your voice note and gently identifies key signals — names, needs, milestones. Your Shepherd sees these woven into the weekly Metro Narrative. The family\'s Journey chapter updates quietly. You don\'t need to do anything else.',
      },
      {
        heading: 'Tips for great voice notes',
        body: 'Be yourself. Speak conversationally. Mention names when you can. Note what you noticed — not just what was said. "Marcus seemed tired" is as valuable as "Marcus needs a job referral." The human context is what makes CROS™ different from a clipboard.',
      },
    ],
  },
  {
    slug: 'provisions',
    role: 'companion',
    title: 'Managing Technology Provisions as a Companion',
    description: 'How Companions use Prōvīsiō to track device requests, deliveries, and digital inclusion progress.',
    keywords: ['companion provisions', 'technology distribution', 'digital inclusion', 'CROS companion'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'What are provisions?',
        body: 'Prōvīsiō is the module for tracking technology requests and deliveries — refurbished laptops, tablets, hotspots, and other tools that help people connect. As a Companion, you\'re often the person who receives the request, prepares the device, and delivers it.',
      },
      {
        heading: 'Creating a provision request',
        body: 'When someone needs a device, create a provision request from their contact page. Select the device type, add any notes ("Needs Spanish language setup"), and assign it to yourself or another team member. The request enters a simple queue — no approval workflows unless your Shepherd enables them.',
      },
      {
        heading: 'Tracking delivery',
        body: 'When you deliver a device, mark the provision as complete. Add a quick reflection: "Delivered Chromebook to the Garcia family. Set up Wi-Fi together. Mrs. Garcia wants to learn email." This reflection becomes part of the family\'s relationship memory.',
      },
      {
        heading: 'Why this matters',
        body: 'A device is not just a device. It\'s a moment of connection — someone trusted you enough to ask for help, and you showed up. Prōvīsiō helps you remember that moment, so the next conversation can build on it.',
      },
    ],
  },
  {
    slug: 'weekly-narrative',
    role: 'shepherd',
    title: 'Reading the Weekly Narrative',
    description: 'How Shepherds use the Metro Narrative to stay aware of community patterns without dashboard fatigue.',
    keywords: ['weekly narrative', 'metro narrative', 'community awareness', 'CROS shepherd'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'What is the Weekly Narrative?',
        body: 'Every week, NRI™ compiles a short narrative summary of what happened in your community. It weaves together Reflections from Companions, voice notes from Visitors, Signum signals from the news, and relationship patterns from Testimonium. The result is a story — not a dashboard.',
      },
      {
        heading: 'How to read it',
        body: 'Open your Metro Narrative on Monday morning with your coffee. It reads like a letter, not a report: "This week, three families re-engaged after a quiet period. Two volunteers logged their highest hours. A new community center opened on Oak Street. One longtime member has been quiet for three weeks."',
      },
      {
        heading: 'What to do with it',
        body: 'Nothing, if nothing calls to you. The narrative is awareness, not a to-do list. Some weeks you\'ll read it and feel reassured. Other weeks, a sentence will catch your eye — and you\'ll know exactly who to call. That\'s the point.',
      },
    ],
  },
  {
    slug: 'reflections',
    role: 'companion',
    title: 'Writing Effective Reflections',
    description: 'How Companions capture the human context that makes relationships meaningful — without writing reports.',
    keywords: ['companion reflections', 'relationship journaling', 'CROS reflections', 'care documentation'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'What is a Reflection?',
        body: 'A Reflection is a brief, private note about a conversation, visit, or moment. It\'s not a case note. It\'s not a report. It\'s what you noticed — the human context that no form could capture.',
      },
      {
        heading: 'When to write one',
        body: 'After any meaningful interaction. A phone call where someone opened up. A coffee meeting where a new need emerged. A delivery where you noticed something had changed. You don\'t need to write one after every contact — just when something mattered.',
      },
      {
        heading: 'What to include',
        body: 'Write what you noticed, not just what was said. "Maria seemed lighter today — first time she laughed in our meetings" is more valuable than "Discussed program enrollment." Include emotions, observations, and anything you want to remember next time you see this person.',
      },
      {
        heading: 'How they\'re used',
        body: 'Reflections feed into the Metro Narrative that your Shepherd reads. They\'re anonymized and woven into the community story — never exposed as raw notes. NRI™ may gently suggest a follow-up if a Reflection mentions something worth revisiting. Your privacy is always preserved.',
      },
    ],
  },
  {
    slug: 'visit-checklist',
    role: 'visitor',
    title: 'Preparing for a Visit',
    description: 'A simple guide for Visitors preparing for home visits — what to check, what to bring, and how to be present.',
    keywords: ['visitor checklist', 'home visit preparation', 'field visit guide', 'CROS visitor'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'Before you go',
        body: 'Open CROS™ on your phone and check your Visit Assignments. You\'ll see who you\'re visiting, any notes from your Shepherd ("Ask about the new job"), and the last visit summary. Take 60 seconds to read it. That context will make your visit more meaningful.',
      },
      {
        heading: 'What to bring',
        body: 'Your phone (for voice notes), a genuine smile, and whatever your Shepherd has asked you to deliver — a Bible, a food box, a flyer. Don\'t bring a clipboard. Don\'t bring a laptop. Your presence is the gift.',
      },
      {
        heading: 'During the visit',
        body: 'Be present. Listen. Notice. You\'re not there to collect data — you\'re there to be human. If something important comes up, make a mental note. You\'ll record it after you leave.',
      },
      {
        heading: 'After the visit',
        body: 'Walk to your car. Tap the microphone. Speak for 30-60 seconds about what you noticed. That\'s the entire workflow. Your voice note will be transcribed and woven into the community story by NRI™. You\'ve done your part beautifully.',
      },
    ],
  },
  {
    slug: 'workspace-setup',
    role: 'steward',
    title: 'Setting Up Your CROS Workspace',
    description: 'How Stewards configure a new CROS™ workspace — choosing an archetype, inviting the team, and activating modules.',
    keywords: ['CROS setup', 'workspace configuration', 'steward guide', 'onboarding'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'Choosing your archetype',
        body: 'During onboarding, you\'ll select a Mission Archetype — Church, Digital Inclusion Nonprofit, Social Enterprise, and more. This choice adjusts default language, journey stages, and Signum keywords to match your mission context. You can change it later.',
      },
      {
        heading: 'Inviting your team',
        body: 'From the Admin console, invite team members by email. Each person will choose their role during their own onboarding: Shepherd, Companion, or Visitor. You don\'t need to decide for them — let people self-select based on how they serve.',
      },
      {
        heading: 'Activating modules',
        body: 'CROS Core includes Relationships, Journeys, Reflections, Events, and basic Signum. If your plan includes Insight or Story tiers, you\'ll see additional modules like Testimonium, Impulsus, and advanced narrative tools. Activate what you need — leave the rest quiet.',
      },
      {
        heading: 'Your first week',
        body: 'Don\'t try to configure everything at once. Start with your people list and one Reflection. The Activation Checklist will gently guide you through the rest — one step at a time, at your pace.',
      },
    ],
  },
  {
    slug: 'team-invites',
    role: 'steward',
    title: 'Inviting Your Team to CROS',
    description: 'How Stewards invite Shepherds, Companions, and Visitors — and why self-selection matters.',
    keywords: ['team invites', 'CROS onboarding', 'steward team management', 'role selection'],
    datePublished: '2026-02-20',
    sections: [
      {
        heading: 'Why self-selection matters',
        body: 'CROS™ lets each team member choose their own role. This isn\'t just a UX choice — it\'s a philosophy. When people identify with how they serve, they engage more deeply. A volunteer who chooses "Visitor" feels ownership of that identity.',
      },
      {
        heading: 'Sending invitations',
        body: 'From Admin → Team, enter email addresses. Each person receives a warm invitation email with a brief explanation of what CROS™ is. They\'ll create their account and be guided through a simplified onboarding — choosing their role and seeing what\'s relevant to them.',
      },
      {
        heading: 'Role guidance',
        body: 'You can include a note with each invitation: "You\'ll love the Visitor experience — just voice notes and a simple list." or "As our program director, the Shepherd view will give you the narrative overview." This gentle guidance helps without prescribing.',
      },
      {
        heading: 'After they join',
        body: 'You\'ll see your team members in the Admin console with their chosen roles. The Activation Checklist updates to reflect team readiness. You don\'t need to train anyone — each role has its own gentle onboarding path.',
      },
    ],
  },
];

/** Get guides for a specific role */
export function getGuidesForRole(role: string): RoleGuide[] {
  return roleGuides.filter((g) => g.role === role);
}

/** Get a specific guide by role and slug */
export function getGuide(role: string, slug: string): RoleGuide | undefined {
  return roleGuides.find((g) => g.role === role && g.slug === slug);
}
