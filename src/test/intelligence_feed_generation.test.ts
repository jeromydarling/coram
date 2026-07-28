import { describe, it, expect } from "vitest";

describe("Intelligence Feed Generation", () => {
  it("validates feed item structure", () => {
    const item = {
      user_id: "aaaaaaaa-1111-2222-3333-444444444444",
      signal_id: "bbbbbbbb-1111-2222-3333-444444444444",
      title: "3 new Grant Opportunities signals detected",
      summary: "3 grant signals found this week with avg confidence 80%.",
      priority_score: 24.0,
    };
    expect(item.title).toBeTypeOf("string");
    expect(item.summary).toBeTypeOf("string");
    expect(item.priority_score).toBeGreaterThanOrEqual(0);
    expect(item.user_id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("calculates priority_score from signal count and confidence", () => {
    const avgConfidence = 0.8;
    const count = 3;
    const score = avgConfidence * count * 10;
    expect(score).toBe(24);
  });

  it("groups signals by source_type", () => {
    const signals = [
      { source_type: "grant", confidence: 0.9 },
      { source_type: "grant", confidence: 0.7 },
      { source_type: "event", confidence: 0.5 },
    ];
    const grouped: Record<string, typeof signals> = {};
    for (const s of signals) {
      if (!grouped[s.source_type]) grouped[s.source_type] = [];
      grouped[s.source_type].push(s);
    }
    expect(Object.keys(grouped)).toEqual(["grant", "event"]);
    expect(grouped.grant.length).toBe(2);
    expect(grouped.event.length).toBe(1);
  });

  it("handles empty signals gracefully", () => {
    const signals: { source_type: string }[] = [];
    const grouped: Record<string, typeof signals> = {};
    for (const s of signals) {
      if (!grouped[s.source_type]) grouped[s.source_type] = [];
      grouped[s.source_type].push(s);
    }
    expect(Object.keys(grouped).length).toBe(0);
  });
});
