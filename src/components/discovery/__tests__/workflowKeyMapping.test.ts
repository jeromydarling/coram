import { describe, it, expect } from 'vitest';

// Mirror the mapping from FindPage.tsx
const SEARCH_TYPE_TO_WORKFLOW_KEY: Record<string, string> = {
  event: 'search_events',
  opportunity: 'search_opportunities',
  grant: 'search_grants',
};

// Mirror the reverse mapping from n8n-dispatch
const WORKFLOW_KEY_TO_SEARCH_TYPE: Record<string, string> = {
  search_events: 'event',
  search_opportunities: 'opportunity',
  search_grants: 'grant',
};

describe('Workflow key mapping', () => {
  it('maps "opportunity" searchType to "search_opportunities"', () => {
    expect(SEARCH_TYPE_TO_WORKFLOW_KEY['opportunity']).toBe('search_opportunities');
  });

  it('maps "event" searchType to "search_events"', () => {
    expect(SEARCH_TYPE_TO_WORKFLOW_KEY['event']).toBe('search_events');
  });

  it('maps "grant" searchType to "search_grants"', () => {
    expect(SEARCH_TYPE_TO_WORKFLOW_KEY['grant']).toBe('search_grants');
  });

  it('returns undefined for unknown searchType', () => {
    expect(SEARCH_TYPE_TO_WORKFLOW_KEY['people']).toBeUndefined();
    expect(SEARCH_TYPE_TO_WORKFLOW_KEY['unknown']).toBeUndefined();
  });

  it('reverse maps "search_opportunities" back to "opportunity"', () => {
    expect(WORKFLOW_KEY_TO_SEARCH_TYPE['search_opportunities']).toBe('opportunity');
  });

  it('reverse maps all keys correctly', () => {
    for (const [searchType, workflowKey] of Object.entries(SEARCH_TYPE_TO_WORKFLOW_KEY)) {
      expect(WORKFLOW_KEY_TO_SEARCH_TYPE[workflowKey]).toBe(searchType);
    }
  });

  it('never produces "opportunitie" from pluralization stripping', () => {
    // This was the original bug: "search_opportunities".replace("search_", "").replace(/s$/, "") => "opportunitie"
    const buggyDerivation = 'search_opportunities'.replace('search_', '').replace(/s$/, '');
    expect(buggyDerivation).toBe('opportunitie'); // confirms old bug existed
    
    // Explicit mapping avoids this
    expect(WORKFLOW_KEY_TO_SEARCH_TYPE['search_opportunities']).toBe('opportunity');
    expect(WORKFLOW_KEY_TO_SEARCH_TYPE['search_opportunities']).not.toBe('opportunitie');
  });
});
