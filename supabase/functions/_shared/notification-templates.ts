/**
 * Server-side notification message templates.
 * 
 * Copywriting rules:
 * - No pressure language, no "you must", no performance framing.
 * - Use: "if helpful", "ready when you are", "new context available".
 */

export interface NotificationMessage {
  title: string;
  body: string;
  deep_link: string;
  priority: 'low' | 'normal' | 'high';
  fingerprint: string;
  tier: 'T1' | 'T2' | 'T3';
  bundle_key?: string;
}

export function watchlistSignalMessage(params: {
  org_id: string;
  org_name?: string;
  signal_summary: string;
  signal_id: string;
  confidence: number;
}): NotificationMessage {
  const orgLabel = params.org_name || 'an organization';
  return {
    title: '📡 New website signal detected',
    body: `New context available for ${orgLabel} — ready when you are.`,
    deep_link: `/organizations/${params.org_id}`,
    priority: params.confidence >= 0.8 ? 'high' : 'normal',
    fingerprint: `watchlist_signal:${params.signal_id}`,
    tier: 'T1',
    bundle_key: `watchlist:${params.org_id}`,
  };
}

export function campaignSuggestionMessage(params: {
  suggestion_id: string;
  org_id: string;
  org_name?: string;
  title: string;
}): NotificationMessage {
  return {
    title: '💡 New outreach suggestion',
    body: `${params.title} — if helpful, it's ready for your review.`,
    deep_link: `/campaigns/suggestions`,
    priority: 'normal',
    fingerprint: `campaign_suggestion:${params.suggestion_id}`,
    tier: 'T1',
    bundle_key: `campaign_sug:${params.org_id}`,
  };
}

export function eventEnrichmentMessage(params: {
  event_id: string;
  event_name: string;
  match_count: number;
}): NotificationMessage {
  return {
    title: '🎯 Attendee matches found',
    body: `${params.match_count} match${params.match_count > 1 ? 'es' : ''} found for ${params.event_name} — available when you're ready.`,
    deep_link: `/events/${params.event_id}/attendees`,
    priority: 'normal',
    fingerprint: `event_enrichment:${params.event_id}:${Date.now()}`,
    tier: 'T1',
  };
}

export function campaignSendSummaryMessage(params: {
  campaign_id: string;
  campaign_name: string;
  sent_count: number;
  failed_count: number;
}): NotificationMessage {
  const total = params.sent_count + params.failed_count;
  return {
    title: '📧 Campaign send complete',
    body: `${params.campaign_name}: ${params.sent_count}/${total} delivered — details available if needed.`,
    deep_link: `/campaigns/${params.campaign_id}`,
    priority: 'low',
    fingerprint: `campaign_send:${params.campaign_id}:${Date.now()}`,
    tier: 'T2',
    bundle_key: `campaign_send:${params.campaign_id}`,
  };
}

export function automationFailedMessage(params: {
  workflow_key: string;
  run_id: string;
  error_message?: string;
}): NotificationMessage {
  return {
    title: '⚠️ Automation needs attention',
    body: `${params.workflow_key} encountered an issue — details available in admin panel.`,
    deep_link: '/admin/automations',
    priority: 'high',
    fingerprint: `automation_failed:${params.run_id}`,
    tier: 'T1',
  };
}

export function dailyDigestMessage(params: {
  signal_count: number;
  suggestion_count: number;
  enrichment_count: number;
}): NotificationMessage {
  const parts: string[] = [];
  if (params.signal_count > 0) parts.push(`${params.signal_count} new signal${params.signal_count > 1 ? 's' : ''}`);
  if (params.suggestion_count > 0) parts.push(`${params.suggestion_count} suggestion${params.suggestion_count > 1 ? 's' : ''}`);
  if (params.enrichment_count > 0) parts.push(`${params.enrichment_count} enrichment match${params.enrichment_count > 1 ? 'es' : ''}`);

  return {
    title: '📋 Your Daily Digest',
    body: parts.length > 0 ? `${parts.join(', ')} — ready when you are.` : 'No new activity today.',
    deep_link: '/',
    priority: 'low',
    fingerprint: `daily_digest:${new Date().toISOString().slice(0, 10)}`,
    tier: 'T3',
  };
}

export function eventRegistrationMessage(params: {
  event_id: string;
  event_name: string;
  guest_name: string;
}): NotificationMessage {
  return {
    title: '🌱 New event registration',
    body: `${params.guest_name} registered for ${params.event_name} — your community is growing.`,
    deep_link: `/events/${params.event_id}`,
    priority: 'normal',
    fingerprint: `event_reg:${params.event_id}:${Date.now()}`,
    tier: 'T1',
    bundle_key: `event_reg:${params.event_id}`,
  };
}

export function communioInviteReceivedMessage(params: {
  group_id: string;
  group_name?: string;
}): NotificationMessage {
  return {
    title: '🤝 Communio invitation',
    body: `A neighboring organization has invited you to ${params.group_name || 'a group'} — ready when you are.`,
    deep_link: '/communio',
    priority: 'normal',
    fingerprint: `communio_invite:${params.group_id}:${Date.now()}`,
    tier: 'T1',
  };
}

export function communioInviteAcceptedMessage(params: {
  group_id: string;
  group_name?: string;
}): NotificationMessage {
  return {
    title: '🎉 Invitation accepted',
    body: `A new organization has joined ${params.group_name || 'your group'} — your network is growing.`,
    deep_link: '/communio',
    priority: 'low',
    fingerprint: `communio_accept:${params.group_id}:${Date.now()}`,
    tier: 'T2',
  };
}

export function livingSignalMessage(params: {
  signal_type: string;
  signal_id: string;
}): NotificationMessage {
  const narratives: Record<string, string> = {
    reflection_moment: 'A moment of reflection has been noticed.',
    community_growth: 'New people are connecting — your community is growing.',
    adoption_support_needed: 'Some teammates may need a simpler starting point.',
    collaboration_movement: 'Your network collaboration is strengthening.',
    visitor_voice_pattern: 'Voice notes are becoming part of your rhythm.',
  };

  return {
    title: '✨ A moment worth noticing',
    body: narratives[params.signal_type] || 'Something gentle is happening in your community.',
    deep_link: '/',
    priority: 'low',
    fingerprint: `living_signal:${params.signal_id}`,
    tier: 'T2',
  };
}

export function weeklySummaryMessage(): NotificationMessage {
  return {
    title: '📊 Your Weekly Summary',
    body: 'Your week in review is ready — take a look if helpful.',
    deep_link: '/',
    priority: 'low',
    fingerprint: `weekly_summary:${new Date().toISOString().slice(0, 10)}`,
    tier: 'T3',
  };
}

export function meetingNotesReadyMessage(params: {
  meeting_note_id: string;
  meeting_title: string;
  tasks_created: number;
  contacts_linked: number;
  contact_slug?: string;
}): NotificationMessage {
  const taskPart = params.tasks_created > 0
    ? ` with ${params.tasks_created} action item${params.tasks_created > 1 ? 's' : ''}`
    : '';
  return {
    title: '📝 Meeting notes ready',
    body: `Notes from ${params.meeting_title}${taskPart} — available when you're ready.`,
    deep_link: params.contact_slug ? `/people/${params.contact_slug}` : '/',
    priority: 'normal',
    fingerprint: `meeting_notes:${params.meeting_note_id}`,
    tier: 'T1',
  };
}
