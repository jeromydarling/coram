/**
 * Event stream / action breadcrumb tests.
 *
 * WHAT: Tests privacy-safe event logging.
 * WHERE: src/lib/eventStream.ts
 * WHY: Ensures allowlisting, silent failure, and no PII leakage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ data: null }));
const mockGetSession = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  }),
);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: () => ({
      insert: mockInsert,
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
  },
}));

import {
  isAllowedActionEventType,
  logActionEvent,
  type ActionEvent,
} from '@/lib/eventStream';

describe('isAllowedActionEventType', () => {
  it('accepts valid event types', () => {
    expect(isAllowedActionEventType('entity_created')).toBe(true);
    expect(isAllowedActionEventType('entity_deleted')).toBe(true);
    expect(isAllowedActionEventType('role_switched')).toBe(true);
  });

  it('rejects unknown event types', () => {
    expect(isAllowedActionEventType('hacked')).toBe(false);
    expect(isAllowedActionEventType('')).toBe(false);
    expect(isAllowedActionEventType('ENTITY_CREATED')).toBe(false);
  });
});

describe('logActionEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('silently skips disallowed event types', () => {
    logActionEvent({ event_type: 'bad_event', entity_type: 'contacts' });
    // insert should NOT be called synchronously (the function returns immediately)
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('silently skips disallowed entity types', () => {
    logActionEvent({ event_type: 'entity_created', entity_type: 'secret_table' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('metadata only contains allowed keys', async () => {
    logActionEvent({
      event_type: 'entity_created',
      entity_type: 'contacts',
      entity_id: 'c1',
      metadata: { source: 'ui', surface: 'list', ssn: '123-45-6789' } as any,
    });

    // Wait for async fire-and-forget
    await vi.waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });

    const payload = mockInsert.mock.calls[0][0];
    expect(payload.metadata.entity_type).toBe('contacts');
    expect(payload.metadata.entity_id).toBe('c1');
    expect(payload.metadata.source).toBe('ui');
    expect(payload.metadata.surface).toBe('list');
    expect(payload.metadata.ssn).toBeUndefined();
  });
});
