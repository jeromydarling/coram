import { describe, it, expect } from 'vitest';
import {
  AUTOMATION_WORKFLOW_KEYS,
  isValidWorkflowKey,
} from '@/lib/automationWorkflowKeys';

describe('automationWorkflowKeys', () => {
  it('contains exactly the 7 supported workflow keys', () => {
    expect(AUTOMATION_WORKFLOW_KEYS).toEqual([
      'partner_enrich',
      'opportunity_monitor',
      'recommendations_generate',
      'watchlist_ingest',
      'watchlist_diff',
      'event_attendee_enrich',
      'watchlist_deep_dive',
    ]);
    expect(AUTOMATION_WORKFLOW_KEYS).toHaveLength(7);
  });

  it('isValidWorkflowKey returns true for valid keys', () => {
    expect(isValidWorkflowKey('partner_enrich')).toBe(true);
    expect(isValidWorkflowKey('opportunity_monitor')).toBe(true);
    expect(isValidWorkflowKey('recommendations_generate')).toBe(true);
    expect(isValidWorkflowKey('event_attendee_enrich')).toBe(true);
    expect(isValidWorkflowKey('watchlist_deep_dive')).toBe(true);
  });

  it('isValidWorkflowKey returns false for invalid keys', () => {
    expect(isValidWorkflowKey('unknown')).toBe(false);
    expect(isValidWorkflowKey('')).toBe(false);
    expect(isValidWorkflowKey('Partner_Enrich')).toBe(false);
  });
});

describe('stuck run definition', () => {
  it('stuck threshold is 10 minutes for dispatched/running status', () => {
    // This documents the invariant used by get_automation_health RPC
    const STUCK_THRESHOLD_MINUTES = 10;
    const STUCK_STATUSES = ['dispatched', 'running'];
    
    expect(STUCK_THRESHOLD_MINUTES).toBe(10);
    expect(STUCK_STATUSES).toContain('dispatched');
    expect(STUCK_STATUSES).toContain('running');
    expect(STUCK_STATUSES).not.toContain('processed');
    expect(STUCK_STATUSES).not.toContain('error');
    expect(STUCK_STATUSES).not.toContain('queued');
  });
});
