/**
 * emailPreview — Generates email-ready preview content for essays.
 *
 * WHAT: Creates subject lines, preview text, and one-sentence summaries for notifications.
 * WHERE: Used by Gardener morning digest, essay-ready notifications, Communio sharing.
 * WHY: Every essay announcement should feel like an invitation, not a broadcast.
 */

export interface EmailPreviewInput {
  title: string;
  summary?: string;
  bodySnippet?: string;
  voiceOrigin?: 'nri' | 'operator' | 'tenant';
  essayType?: string;
}

export interface EmailPreviewOutput {
  subjectLine: string;
  previewText: string;
  oneSentenceSummary: string;
}

/**
 * Generates warm, non-promotional email preview content.
 */
export function generateEmailPreview(input: EmailPreviewInput): EmailPreviewOutput {
  const { title, summary, bodySnippet, voiceOrigin, essayType } = input;

  // Subject line: gentle, inviting, under 60 chars
  const prefix = voiceOrigin === 'nri'
    ? 'A new reflection'
    : essayType === 'field_note'
      ? 'A field note'
      : 'A new essay';

  const subjectLine = `${prefix}: ${title}`.slice(0, 58);

  // Preview text: first 120 chars of summary or body
  const rawPreview = summary
    || bodySnippet?.replace(/[#*_<>[\]]/g, '').trim()
    || '';
  const previewText = rawPreview.slice(0, 120) + (rawPreview.length > 120 ? '…' : '');

  // One-sentence summary
  const oneSentenceSummary = summary
    ? summary.split(/[.!?]/)[0].trim() + '.'
    : `A new reflection titled "${title}" is ready for your review.`;

  return { subjectLine, previewText, oneSentenceSummary };
}
