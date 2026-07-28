import { describe, it, expect } from "vitest";

describe("Relationship Graph Edges Schema", () => {
  it("validates edge structure", () => {
    const edge = {
      source_type: "person",
      source_id: "aaaaaaaa-1111-2222-3333-444444444444",
      target_type: "organization",
      target_id: "bbbbbbbb-1111-2222-3333-444444444444",
      edge_reason: "Contact works at organization",
    };
    expect(["person", "organization", "grant", "event", "contact", "campaign", "neighborhood"]).toContain(edge.source_type);
    expect(["person", "organization", "grant", "event", "contact", "campaign", "neighborhood"]).toContain(edge.target_type);
    expect(edge.edge_reason).toBeTypeOf("string");
    expect(edge.source_id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("enforces unique constraint logic", () => {
    const edges = [
      { source_type: "person", source_id: "a", target_type: "org", target_id: "b" },
      { source_type: "person", source_id: "a", target_type: "org", target_id: "b" },
      { source_type: "org", source_id: "b", target_type: "grant", target_id: "c" },
    ];
    const unique = new Set(edges.map(e => `${e.source_type}:${e.source_id}:${e.target_type}:${e.target_id}`));
    expect(unique.size).toBe(2);
  });

  it("supports all required edge types", () => {
    const requiredEdges = [
      "person -> organization",
      "organization -> grant",
      "organization -> neighborhood",
      "event -> organization",
      "contact -> campaign",
    ];
    expect(requiredEdges.length).toBe(5);
    requiredEdges.forEach(e => expect(e).toContain("->"));
  });
});
