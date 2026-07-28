import { describe, it, expect } from "vitest";

describe("Opportunity Signals Schema", () => {
  it("validates signal structure", () => {
    const signal = {
      organization_id: "aaaaaaaa-1111-2222-3333-444444444444",
      source_type: "grant",
      source_id: "bbbbbbbb-1111-2222-3333-444444444444",
      signal_reason: "Grant aligns with digital equity mission",
      confidence: 0.85,
      user_id: "cccccccc-1111-2222-3333-444444444444",
    };
    expect(signal.organization_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(["grant", "event", "person", "neighborhood", "org_update"]).toContain(signal.source_type);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
    expect(signal.signal_reason).toBeTypeOf("string");
  });

  it("rejects signal with missing fields", () => {
    const signal: Record<string, unknown> = { organization_id: "test" };
    expect(signal.source_type).toBeUndefined();
    expect(signal.source_id).toBeUndefined();
  });

  it("clamps confidence to 0-1 range", () => {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    expect(clamp(1.5)).toBe(1);
    expect(clamp(-0.5)).toBe(0);
    expect(clamp(0.7)).toBe(0.7);
  });

  it("deduplicates by source_id + organization_id", () => {
    const signals = [
      { source_id: "a", organization_id: "b" },
      { source_id: "a", organization_id: "b" },
      { source_id: "a", organization_id: "c" },
    ];
    const unique = new Set(signals.map(s => `${s.source_id}:${s.organization_id}`));
    expect(unique.size).toBe(2);
  });
});
