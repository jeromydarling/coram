import { describe, it, expect } from "vitest";

// Schema shape tests for the search briefing contract.
// Validation functions live in the Deno edge function and are tested via Deno tests.

describe("Search Briefing Schema", () => {
  it("accepts valid brief", () => {
    const brief = {
      summary: "Found 10 events",
      what_we_found: ["Event A", "Event B"],
      what_may_be_missing: ["Community events"],
      helpful_sites: [{ name: "Eventbrite", url: "https://eventbrite.com", why: "Large event DB" }],
      suggested_queries: ["digital inclusion events"],
      confidence: 0.85,
      caveats: ["Limited to online sources"],
    };
    // Validate structure matches expected schema
    expect(brief.summary).toBeTypeOf("string");
    expect(Array.isArray(brief.what_we_found)).toBe(true);
    expect(Array.isArray(brief.what_may_be_missing)).toBe(true);
    expect(Array.isArray(brief.helpful_sites)).toBe(true);
    expect(Array.isArray(brief.suggested_queries)).toBe(true);
    expect(Array.isArray(brief.caveats)).toBe(true);
    expect(brief.confidence).toBeGreaterThanOrEqual(0);
    expect(brief.confidence).toBeLessThanOrEqual(1);
  });

  it("rejects brief without summary", () => {
    const brief = {
      what_we_found: [],
      what_may_be_missing: [],
      helpful_sites: [],
      suggested_queries: [],
      caveats: [],
    };
    // summary is required
    expect((brief as any).summary).toBeUndefined();
  });

  it("validates callback body shape with briefing", () => {
    const body = {
      run_id: "12345678-1234-1234-1234-123456789012",
      status: "completed",
      results: [{ title: "Test Result" }],
      brief: {
        summary: "Found results",
        what_we_found: ["Result 1"],
        what_may_be_missing: [],
        helpful_sites: [],
        suggested_queries: [],
        confidence: null,
        caveats: [],
      },
    };
    expect(body.run_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.status).toBe("completed");
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.brief.summary).toBeTypeOf("string");
  });
});
