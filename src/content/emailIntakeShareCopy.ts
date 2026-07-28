/**
 * emailIntakeShareCopy — Prewritten share-ready copy for Simple Intake (Email Notes).
 *
 * WHAT: Role-agnostic messaging templates for stewards to share with teams.
 * WHERE: Settings card, onboarding confirmation, copy buttons.
 * WHY: Reduces adoption friction — stewards share in one click, no training required.
 */

export function getIntakeAddress(tenantSlug: string): string {
  return `intake+${tenantSlug}@thecros.app`;
}

export function getEmailIntakeCopy(tenantSlug: string) {
  const address = getIntakeAddress(tenantSlug);

  return {
    short_message: `After a visit or conversation, just send your notes to:\n${address}\n\nCROS will log it automatically — no app required.`,

    staff_version: `Field notes can be emailed directly into CROS.\n\nSend updates after visits, meetings, or outreach moments to:\n${address}\n\nNo login needed. Just write what happened and hit send. The system takes care of the rest.`,

    bulletin_version: `We want to make it easy for everyone to contribute.\n\nIf you prefer email over apps, you can send visit notes, reflections, or updates to:\n${address}\n\nYour notes will be saved automatically and connected to the people and stories that matter most.\n\nNo formatting required — just write naturally.`,
  };
}

export type IntakeCopyKey = 'short_message' | 'staff_version' | 'bulletin_version';

export const INTAKE_COPY_LABELS: Record<IntakeCopyKey, string> = {
  short_message: 'Copy quick message',
  staff_version: 'Copy staff version',
  bulletin_version: 'Copy bulletin version',
};
