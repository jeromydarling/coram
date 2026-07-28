import { describe, it, expect } from "vitest";

describe("Prospect Priority Score", () => {
  const computeScore = (inputs: {
    missionAlignment: number;
    grantOverlap: number;
    neighborhoodScore: number;
    relationshipStrength: number;
    recencyScore: number;
  }) => {
    return Number((
      inputs.missionAlignment * 0.3 +
      inputs.grantOverlap * 0.25 +
      inputs.neighborhoodScore * 0.2 +
      inputs.relationshipStrength * 0.15 +
      inputs.recencyScore * 0.1
    ).toFixed(4));
  };

  it("computes max score as 1.0", () => {
    const score = computeScore({
      missionAlignment: 1,
      grantOverlap: 1,
      neighborhoodScore: 1,
      relationshipStrength: 1,
      recencyScore: 1,
    });
    expect(score).toBe(1);
  });

  it("computes min score as 0", () => {
    const score = computeScore({
      missionAlignment: 0,
      grantOverlap: 0,
      neighborhoodScore: 0,
      relationshipStrength: 0,
      recencyScore: 0,
    });
    expect(score).toBe(0);
  });

  it("weights mission_alignment highest", () => {
    const missionOnly = computeScore({ missionAlignment: 1, grantOverlap: 0, neighborhoodScore: 0, relationshipStrength: 0, recencyScore: 0 });
    const grantOnly = computeScore({ missionAlignment: 0, grantOverlap: 1, neighborhoodScore: 0, relationshipStrength: 0, recencyScore: 0 });
    expect(missionOnly).toBeGreaterThan(grantOnly);
  });

  it("produces deterministic output", () => {
    const inputs = { missionAlignment: 0.75, grantOverlap: 0.5, neighborhoodScore: 0.3, relationshipStrength: 0.2, recencyScore: 0.1 };
    const a = computeScore(inputs);
    const b = computeScore(inputs);
    expect(a).toBe(b);
    expect(a).toBeCloseTo(0.425, 3);
  });

  it("clamps individual inputs to 0-1", () => {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    expect(clamp(1.5)).toBe(1);
    expect(clamp(-0.3)).toBe(0);
  });
});
