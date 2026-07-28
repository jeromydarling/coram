/**
 * integrationVoice — Archetype-aware voice for Relatio integration pages.
 *
 * WHAT: Returns tone-appropriate copy for integration setup based on archetype.
 * WHERE: RelatioMarketplace, IntegrationGuidePanel.
 * WHY: Parish leaders need pastoral language; nonprofits need operational clarity.
 */

export interface IntegrationVoice {
  heroTitle: string;
  heroSubtitle: string;
  companionMessage: string;
  encouragement: string[];
  handRaiseLabel: string;
}

const DEFAULT_VOICE: IntegrationVoice = {
  heroTitle: 'Connect the tools your organization already uses',
  heroSubtitle: "You don't have to migrate. Start by listening.",
  companionMessage: "Your system stays the source of record. CROS helps you see the story.",
  encouragement: ["You're doing great.", "One more step.", "Almost there."],
  handRaiseLabel: 'Request Guided Setup',
};

const VOICE_MAP: Record<string, IntegrationVoice> = {
  church: {
    heroTitle: 'Bring your ministry memory into CROS',
    heroSubtitle: 'We walk alongside the tools you already use.',
    companionMessage: 'Your parish system stays the source of record. CROS helps you see the relationships.',
    encouragement: ["You're doing great.", "One more step — you've got this.", "Almost there. Your parish data is in good hands."],
    handRaiseLabel: 'Request Guided Setup',
  },
  ministry_outreach: {
    heroTitle: 'Let CROS quietly accompany your ministry tools',
    heroSubtitle: 'Nothing changes in your existing system. CROS adds narrative awareness.',
    companionMessage: 'Your ministry platform stays in charge. CROS adds relational depth.',
    encouragement: ["You're doing great.", 'Just one more step.', 'Your outreach data is almost connected.'],
    handRaiseLabel: 'Request Guided Setup',
  },
  digital_inclusion: {
    heroTitle: 'Connect your existing system — without replacing it',
    heroSubtitle: 'CROS observes quietly and surfaces what matters.',
    companionMessage: 'Your CRM stays the source of truth. CROS generates narrative signals.',
    encouragement: ['Looking good.', 'One more step.', 'Almost connected.'],
    handRaiseLabel: 'Request Guided Setup',
  },
  social_enterprise: {
    heroTitle: 'CROS listens alongside your tools — adding human context',
    heroSubtitle: 'Your operations stay unchanged. CROS adds narrative depth.',
    companionMessage: 'Your system stays in control. CROS surfaces community patterns.',
    encouragement: ['Great progress.', 'Nearly there.', 'Your data is in safe hands.'],
    handRaiseLabel: 'Request Guided Setup',
  },
  workforce_dev: {
    heroTitle: 'Connect your case management — CROS listens gently',
    heroSubtitle: 'Your tools stay trusted. CROS adds relationship memory.',
    companionMessage: 'Your workforce system stays the record. CROS adds context.',
    encouragement: ['Well done.', 'One step left.', 'Connection almost ready.'],
    handRaiseLabel: 'Request Guided Setup',
  },
  refugee_support: {
    heroTitle: 'CROS accompanies your care system with gentle awareness',
    heroSubtitle: 'No data migration. Just quiet observation and narrative signals.',
    companionMessage: 'Your care system stays intact. CROS notices family movement.',
    encouragement: ['You are doing important work.', 'Almost connected.', 'Your families are in good hands.'],
    handRaiseLabel: 'Request Guided Setup',
  },
  housing_shelter: {
    heroTitle: 'CROS accompanies your shelter system with care',
    heroSubtitle: 'Your tools remain. CROS adds gentle family context.',
    companionMessage: 'Your shelter system stays in place. CROS surfaces household signals.',
    encouragement: ['Great progress.', 'One more step.', 'Almost there.'],
    handRaiseLabel: 'Request Guided Setup',
  },
};

export function getIntegrationVoice(archetype?: string | null): IntegrationVoice {
  if (!archetype) return DEFAULT_VOICE;
  return VOICE_MAP[archetype] ?? DEFAULT_VOICE;
}
