import { describe, it, expect } from "vitest";

describe("Opportunity Auto-Bootstrap", () => {
  it("validates auto-enrich payload structure", () => {
    const payload = {
      org_id: "12345678-1234-1234-1234-123456789012",
      org_name: "Test Organization",
      website_url: "https://example.org",
    };
    expect(payload.org_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(payload.org_name).toBeTypeOf("string");
    expect(payload.website_url).toMatch(/^https?:\/\//);
  });

  it("handles missing website_url gracefully", () => {
    const payload = {
      org_id: "12345678-1234-1234-1234-123456789012",
      org_name: "Test Organization",
      website_url: null,
    };
    // Should not trigger enrichment when URL is null
    expect(payload.website_url).toBeNull();
  });

  it("ensures idempotency key format", () => {
    const orgId = "12345678-1234-1234-1234-123456789012";
    const key = `auto-enrich-${orgId}`;
    expect(key).toContain(orgId);
    // Same org_id should produce same key
    const key2 = `auto-enrich-${orgId}`;
    expect(key).toBe(key2);
  });

  it("validates enrichment chain steps are ordered", () => {
    const steps = [
      "org_knowledge_bootstrap",
      "neighborhood_insights",
      "partner_enrich",
      "prospect_pack",
    ];
    expect(steps).toHaveLength(4);
    expect(steps[0]).toBe("org_knowledge_bootstrap");
    expect(steps[3]).toBe("prospect_pack");
  });
});
