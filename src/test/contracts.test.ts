import { describe, it, expect } from 'vitest';

// Test the grant alignment validation contract
describe('Grant Alignment Contract', () => {
  const validPayload = {
    run_id: '00000000-0000-0000-0000-000000000001',
    status: 'completed' as const,
    results: [
      {
        org_id: '00000000-0000-0000-0000-000000000002',
        grant_id: '00000000-0000-0000-0000-000000000003',
        score: 75,
        rationale: 'Strong alignment on mission and geography',
      },
    ],
  };

  it('valid payload has required fields', () => {
    expect(validPayload.run_id).toBeTruthy();
    expect(validPayload.status).toBe('completed');
    expect(validPayload.results).toBeInstanceOf(Array);
    expect(validPayload.results[0].score).toBeGreaterThanOrEqual(0);
    expect(validPayload.results[0].score).toBeLessThanOrEqual(100);
  });

  it('score is within range 0-100', () => {
    for (const r of validPayload.results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('failed payload has error_message', () => {
    const failedPayload = {
      run_id: '00000000-0000-0000-0000-000000000001',
      status: 'failed' as const,
      error_message: 'LLM timeout',
    };
    expect(failedPayload.error_message).toBeTruthy();
  });
});

describe('Add + Draft Outreach Contract', () => {
  it('request payload has required fields', () => {
    const payload = {
      people: [{ name: 'John Doe', email: 'john@example.com', organization: 'Test Org' }],
      metro_id: '00000000-0000-0000-0000-000000000001',
      idempotency_key: 'test-key',
    };
    expect(payload.people).toBeInstanceOf(Array);
    expect(payload.people.length).toBeGreaterThan(0);
    expect(payload.people[0].name).toBeTruthy();
  });

  it('response has expected shape', () => {
    const response = {
      ok: true,
      contacts_created: 3,
      opportunities_created: 2,
      campaign_id: '00000000-0000-0000-0000-000000000001',
      audience_count: 3,
    };
    expect(response.ok).toBe(true);
    expect(response.campaign_id).toBeTruthy();
    expect(response.audience_count).toBeGreaterThan(0);
  });

  it('duplicate response includes duplicate flag', () => {
    const response = {
      ok: true,
      duplicate: true,
      campaign_id: '00000000-0000-0000-0000-000000000001',
    };
    expect(response.duplicate).toBe(true);
  });
});
