/**
 * translator — Narrative Translation Layer for Relatio Companion Mode.
 *
 * WHAT: Converts external ChMS events into CROS narrative signals.
 * WHERE: Used by relatio-sync-runner edge function and staging processors.
 * WHY: CROS does not import data — it translates activity into narrative signals.
 */

export type ExternalEventType =
  | 'household_updated'
  | 'member_added'
  | 'member_removed'
  | 'event_attended'
  | 'event_created'
  | 'check_in'
  | 'group_joined'
  | 'group_left'
  | 'note_added'
  | 'visit_logged'
  | 'donation_recorded'
  | 'volunteer_shift';

export type NarrativeSignalType =
  | 'family_movement'
  | 'community_growth'
  | 'engagement_pattern'
  | 'care_moment'
  | 'group_activity'
  | 'visit_signal'
  | 'service_participation';

interface TranslationResult {
  signalType: NarrativeSignalType;
  narrativeHint: string;
  isHipaaSafe: boolean;
}

const TRANSLATION_MAP: Record<ExternalEventType, TranslationResult> = {
  household_updated: {
    signalType: 'family_movement',
    narrativeHint: 'A household record was updated — family context may have shifted.',
    isHipaaSafe: true,
  },
  member_added: {
    signalType: 'community_growth',
    narrativeHint: 'A new member joined the community.',
    isHipaaSafe: true,
  },
  member_removed: {
    signalType: 'family_movement',
    narrativeHint: 'A member transitioned out of the community.',
    isHipaaSafe: true,
  },
  event_attended: {
    signalType: 'engagement_pattern',
    narrativeHint: 'Someone attended a community event.',
    isHipaaSafe: true,
  },
  event_created: {
    signalType: 'community_growth',
    narrativeHint: 'A new community gathering was planned.',
    isHipaaSafe: true,
  },
  check_in: {
    signalType: 'service_participation',
    narrativeHint: 'A check-in was recorded at a service or gathering.',
    isHipaaSafe: true,
  },
  group_joined: {
    signalType: 'group_activity',
    narrativeHint: 'Someone joined a community group.',
    isHipaaSafe: true,
  },
  group_left: {
    signalType: 'group_activity',
    narrativeHint: 'Someone stepped away from a group.',
    isHipaaSafe: true,
  },
  note_added: {
    signalType: 'care_moment',
    narrativeHint: 'A pastoral or care note was added.',
    isHipaaSafe: true,
  },
  visit_logged: {
    signalType: 'visit_signal',
    narrativeHint: 'A visit was logged in the external system.',
    isHipaaSafe: true,
  },
  donation_recorded: {
    signalType: 'engagement_pattern',
    narrativeHint: 'Generosity was expressed through the community.',
    isHipaaSafe: true,
  },
  volunteer_shift: {
    signalType: 'service_participation',
    narrativeHint: 'Someone served the community through volunteering.',
    isHipaaSafe: true,
  },
};

/**
 * Translates an external ChMS event into a CROS narrative signal.
 * Returns null if the event type is unknown.
 */
export function translateExternalEvent(eventType: string): TranslationResult | null {
  return TRANSLATION_MAP[eventType as ExternalEventType] ?? null;
}

/**
 * Returns all known external event types.
 */
export function getSupportedEventTypes(): ExternalEventType[] {
  return Object.keys(TRANSLATION_MAP) as ExternalEventType[];
}
