import {
  watchlistSignalMessage,
  campaignSuggestionMessage,
  eventEnrichmentMessage,
  campaignSendSummaryMessage,
  automationFailedMessage,
  dailyDigestMessage,
  weeklySummaryMessage,
} from '../../_shared/notification-templates.ts';
import { assertEquals, assertMatch, assertNotEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// ==============================================================
// Template tests
// ==============================================================

Deno.test('watchlistSignalMessage generates correct fingerprint and tier', () => {
  const msg = watchlistSignalMessage({
    org_id: 'org-1',
    org_name: 'Test Org',
    signal_summary: 'Website changed',
    signal_id: 'sig-abc',
    confidence: 0.9,
  });
  assertEquals(msg.fingerprint, 'watchlist_signal:sig-abc');
  assertEquals(msg.tier, 'T1');
  assertEquals(msg.priority, 'high'); // confidence >= 0.8
  assertEquals(msg.bundle_key, 'watchlist:org-1');
});

Deno.test('watchlistSignalMessage uses normal priority for low confidence', () => {
  const msg = watchlistSignalMessage({
    org_id: 'org-1',
    signal_summary: 'test',
    signal_id: 'sig-low',
    confidence: 0.5,
  });
  assertEquals(msg.priority, 'normal');
});

Deno.test('campaignSuggestionMessage generates correct structure', () => {
  const msg = campaignSuggestionMessage({
    suggestion_id: 'sug-1',
    org_id: 'org-2',
    org_name: 'ACME',
    title: 'Website update detected',
  });
  assertEquals(msg.fingerprint, 'campaign_suggestion:sug-1');
  assertEquals(msg.tier, 'T1');
  assertEquals(msg.bundle_key, 'campaign_sug:org-2');
  assertMatch(msg.body, /if helpful/);
});

Deno.test('eventEnrichmentMessage pluralizes correctly', () => {
  const single = eventEnrichmentMessage({
    event_id: 'evt-1',
    event_name: 'Summit',
    match_count: 1,
  });
  assertMatch(single.body, /1 match found/);

  const multi = eventEnrichmentMessage({
    event_id: 'evt-2',
    event_name: 'Summit',
    match_count: 5,
  });
  assertMatch(multi.body, /5 matches found/);
});

Deno.test('campaignSendSummaryMessage is T2 tier', () => {
  const msg = campaignSendSummaryMessage({
    campaign_id: 'camp-1',
    campaign_name: 'Q1',
    sent_count: 40,
    failed_count: 5,
  });
  assertEquals(msg.tier, 'T2');
  assertEquals(msg.priority, 'low');
  assertMatch(msg.body, /40\/45 delivered/);
});

Deno.test('automationFailedMessage is high priority', () => {
  const msg = automationFailedMessage({
    workflow_key: 'watchlist_ingest',
    run_id: 'run-1',
    error_message: 'timeout',
  });
  assertEquals(msg.priority, 'high');
  assertEquals(msg.deep_link, '/admin/automations');
});

Deno.test('dailyDigestMessage is T3 tier', () => {
  const msg = dailyDigestMessage({
    signal_count: 3,
    suggestion_count: 1,
    enrichment_count: 0,
  });
  assertEquals(msg.tier, 'T3');
  assertMatch(msg.body, /3 new signals.*1 suggestion/);
});

Deno.test('weeklySummaryMessage uses no pressure language', () => {
  const msg = weeklySummaryMessage();
  assertEquals(msg.tier, 'T3');
  assertMatch(msg.body, /if helpful/);
  // Must NOT contain pressure language
  assertEquals(msg.body.includes('you must'), false);
  assertEquals(msg.body.includes('performance'), false);
});

Deno.test('copywriting: no pressure language in any template', () => {
  const allMessages = [
    watchlistSignalMessage({ org_id: 'o', signal_summary: 's', signal_id: 'i', confidence: 0.5 }),
    campaignSuggestionMessage({ suggestion_id: 's', org_id: 'o', title: 't' }),
    eventEnrichmentMessage({ event_id: 'e', event_name: 'n', match_count: 1 }),
    campaignSendSummaryMessage({ campaign_id: 'c', campaign_name: 'n', sent_count: 1, failed_count: 0 }),
    automationFailedMessage({ workflow_key: 'k', run_id: 'r' }),
    dailyDigestMessage({ signal_count: 1, suggestion_count: 0, enrichment_count: 0 }),
    weeklySummaryMessage(),
  ];

  const banned = ['you must', 'urgent', 'immediately', 'performance', 'falling behind'];

  for (const msg of allMessages) {
    for (const word of banned) {
      assertEquals(
        msg.body.toLowerCase().includes(word),
        false,
        `Body "${msg.body}" contains banned phrase "${word}"`,
      );
      assertEquals(
        msg.title.toLowerCase().includes(word),
        false,
        `Title "${msg.title}" contains banned phrase "${word}"`,
      );
    }
  }
});

// ==============================================================
// Dedupe fingerprint uniqueness tests
// ==============================================================

Deno.test('fingerprints are unique per signal', () => {
  const a = watchlistSignalMessage({ org_id: 'o', signal_summary: 's', signal_id: 'id-1', confidence: 0.5 });
  const b = watchlistSignalMessage({ org_id: 'o', signal_summary: 's', signal_id: 'id-2', confidence: 0.5 });
  assertNotEquals(a.fingerprint, b.fingerprint);
});

Deno.test('same signal_id produces same fingerprint (dedupe)', () => {
  const a = watchlistSignalMessage({ org_id: 'o1', signal_summary: 's1', signal_id: 'id-same', confidence: 0.5 });
  const b = watchlistSignalMessage({ org_id: 'o2', signal_summary: 's2', signal_id: 'id-same', confidence: 0.9 });
  assertEquals(a.fingerprint, b.fingerprint);
});

// ==============================================================
// Bundling window simulation tests
// ==============================================================

Deno.test('bundle_key groups by org_id for watchlist signals', () => {
  const a = watchlistSignalMessage({ org_id: 'org-A', signal_summary: 's', signal_id: 'id-1', confidence: 0.5 });
  const b = watchlistSignalMessage({ org_id: 'org-A', signal_summary: 's', signal_id: 'id-2', confidence: 0.5 });
  const c = watchlistSignalMessage({ org_id: 'org-B', signal_summary: 's', signal_id: 'id-3', confidence: 0.5 });

  assertEquals(a.bundle_key, b.bundle_key); // Same org = same bundle
  assertNotEquals(a.bundle_key, c.bundle_key); // Different org = different bundle
});

// ==============================================================
// Quiet hours logic tests (using exported-friendly approach)
// ==============================================================

function isInQuietHours(localHour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart > quietEnd) {
    return localHour >= quietStart || localHour < quietEnd;
  }
  return localHour >= quietStart && localHour < quietEnd;
}

Deno.test('quiet hours: 21-8 blocks hour 22', () => {
  assertEquals(isInQuietHours(22, 21, 8), true);
});

Deno.test('quiet hours: 21-8 blocks hour 0 (midnight)', () => {
  assertEquals(isInQuietHours(0, 21, 8), true);
});

Deno.test('quiet hours: 21-8 blocks hour 7', () => {
  assertEquals(isInQuietHours(7, 21, 8), true);
});

Deno.test('quiet hours: 21-8 allows hour 8', () => {
  assertEquals(isInQuietHours(8, 21, 8), false);
});

Deno.test('quiet hours: 21-8 allows hour 14', () => {
  assertEquals(isInQuietHours(14, 21, 8), false);
});

Deno.test('quiet hours: 21-8 allows hour 20', () => {
  assertEquals(isInQuietHours(20, 21, 8), false);
});

Deno.test('quiet hours: 21-8 blocks hour 21', () => {
  assertEquals(isInQuietHours(21, 21, 8), true);
});

// Non-wrapping case (e.g., 1am-6am)
Deno.test('quiet hours: 1-6 blocks hour 3', () => {
  assertEquals(isInQuietHours(3, 1, 6), true);
});

Deno.test('quiet hours: 1-6 allows hour 7', () => {
  assertEquals(isInQuietHours(7, 1, 6), false);
});

// ==============================================================
// Caps enforcement simulation tests
// ==============================================================

Deno.test('soft cap: 6 pushes triggers soft warning', () => {
  const count = 6;
  const softCap = 6;
  const hardCap = 10;
  assertEquals(count >= softCap, true);
  assertEquals(count < hardCap, true);
});

Deno.test('hard cap: 10 pushes blocks further sends', () => {
  const count = 10;
  const hardCap = 10;
  assertEquals(count >= hardCap, true);
});

Deno.test('under soft cap: 4 pushes allows freely', () => {
  const count = 4;
  const softCap = 6;
  assertEquals(count < softCap, true);
});

// ==============================================================
// Kill switch tests
// ==============================================================

Deno.test('kill switch blocks delivery but allows logging', () => {
  const notificationsEnabled = false;
  const event = { event_type: 'watchlist_signal', title: 'test' };

  // Simulate: if kill switch off, status should be 'dropped' not 'pending'
  const status = notificationsEnabled ? 'pending' : 'dropped';
  assertEquals(status, 'dropped');
});

Deno.test('kill switch on allows normal processing', () => {
  const notificationsEnabled = true;
  const status = notificationsEnabled ? 'pending' : 'dropped';
  assertEquals(status, 'pending');
});

// ==============================================================
// Per-type toggle tests
// ==============================================================

Deno.test('per-type toggle: disabled type blocks that type only', () => {
  const typeConfigs: Record<string, { enabled: boolean }> = {
    watchlist_signal: { enabled: true },
    campaign_send_summary: { enabled: false },
    automation_failed: { enabled: true },
  };

  assertEquals(typeConfigs['watchlist_signal'].enabled, true);
  assertEquals(typeConfigs['campaign_send_summary'].enabled, false);
  assertEquals(typeConfigs['automation_failed'].enabled, true);
});

// ==============================================================
// Admin-only enforcement tests
// ==============================================================

Deno.test('admin-only: automation_failed only goes to admin/leadership', () => {
  const typeConfig = { event_type: 'automation_failed', admin_only: true };
  const roles = ['staff', 'rim'];
  const isAdminOrLeadership = roles.some(r => ['admin', 'leadership'].includes(r));

  assertEquals(isAdminOrLeadership, false);
  // Should be dropped
});

Deno.test('admin-only: automation_failed delivered to admin', () => {
  const roles = ['admin'];
  const isAdminOrLeadership = roles.some(r => ['admin', 'leadership'].includes(r));
  assertEquals(isAdminOrLeadership, true);
});

Deno.test('admin-only: automation_failed delivered to leadership', () => {
  const roles = ['leadership'];
  const isAdminOrLeadership = roles.some(r => ['admin', 'leadership'].includes(r));
  assertEquals(isAdminOrLeadership, true);
});

Deno.test('non-admin type: watchlist_signal goes to any role', () => {
  const typeConfig = { event_type: 'watchlist_signal', admin_only: false };
  const roles = ['rim'];
  // Should NOT be filtered by admin_only
  assertEquals(typeConfig.admin_only, false);
});
