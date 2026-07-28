/**
 * Transactional email template registry for CROS app emails.
 * Each template is a React Email component with a subject and optional previewData.
 */
import * as React from 'npm:react@18.3.1'

import { template as welcome } from './welcome.tsx'
import { template as onboardingDay1 } from './onboarding-day-1.tsx'
import { template as onboardingDay3 } from './onboarding-day-3.tsx'
import { template as onboardingDay7 } from './onboarding-day-7.tsx'
import { template as weeklyReflection } from './weekly-reflection.tsx'
import { template as meaningfulDate } from './meaningful-date-approaching.tsx'
import { template as reflectionNudge } from './reflection-nudge.tsx'
import { template as companionCheckIn } from './companion-check-in.tsx'
import { template as localPulseWeekly } from './local-pulse-weekly.tsx'
import { template as newPersonInMetro } from './new-person-in-metro.tsx'
import { template as storyReady } from './story-ready.tsx'
import { template as weeklySignumBrief } from './weekly-signum-brief.tsx'
import { template as grantMatchFound } from './grant-match-found.tsx'
import { template as importComplete } from './import-complete.tsx'
import { template as teamInvitation } from './team-invitation.tsx'
import { template as newDeviceSignin } from './new-device-signin.tsx'
import { template as subscriptionRenewingSoon } from './subscription-renewing-soon.tsx'
import { template as paymentIssue } from './payment-issue.tsx'
import { template as newCompanionReferral } from './new-companion-referral.tsx'
import { template as absorptionRequest } from './absorption-request.tsx'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'onboarding-day-1': onboardingDay1,
  'onboarding-day-3': onboardingDay3,
  'onboarding-day-7': onboardingDay7,
  'weekly-reflection': weeklyReflection,
  'meaningful-date-approaching': meaningfulDate,
  'reflection-nudge': reflectionNudge,
  'companion-check-in': companionCheckIn,
  'local-pulse-weekly': localPulseWeekly,
  'new-person-in-metro': newPersonInMetro,
  'story-ready': storyReady,
  'weekly-signum-brief': weeklySignumBrief,
  'grant-match-found': grantMatchFound,
  'import-complete': importComplete,
  'team-invitation': teamInvitation,
  'new-device-signin': newDeviceSignin,
  'subscription-renewing-soon': subscriptionRenewingSoon,
  'payment-issue': paymentIssue,
  'new-companion-referral': newCompanionReferral,
  'absorption-request': absorptionRequest,
}
