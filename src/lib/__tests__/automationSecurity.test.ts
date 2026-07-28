import { describe, it, expect } from "vitest";
import { hmacSha256Hex, stableStringify, normalizeUrl } from "../automationSecurity";

describe("hmacSha256Hex", () => {
  it("returns expected hex digest for known inputs", async () => {
    const secret = "test-secret-key";
    const body = '{"run_id":"abc","workflow_key":"partner_enrich"}';
    const digest = await hmacSha256Hex(secret, body);

    // Verify it's a 64-char hex string (SHA-256 = 32 bytes = 64 hex chars)
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic: same inputs always produce same output
    const digest2 = await hmacSha256Hex(secret, body);
    expect(digest).toBe(digest2);
  });

  it("produces different digests for different secrets", async () => {
    const body = '{"test":true}';
    const d1 = await hmacSha256Hex("secret-a", body);
    const d2 = await hmacSha256Hex("secret-b", body);
    expect(d1).not.toBe(d2);
  });

  it("produces different digests for different bodies", async () => {
    const secret = "same-secret";
    const d1 = await hmacSha256Hex(secret, '{"a":1}');
    const d2 = await hmacSha256Hex(secret, '{"a":2}');
    expect(d1).not.toBe(d2);
  });
});

describe("normalizeUrl", () => {
  it('prepends https:// when no protocol', () => {
    expect(normalizeUrl("example.org")).toBe("https://example.org/");
  });

  it("trims whitespace", () => {
    expect(normalizeUrl(" https://a.com ")).toBe("https://a.com/");
  });

  it("preserves http:// protocol", () => {
    expect(normalizeUrl("http://a.com")).toBe("http://a.com/");
  });

  it("preserves https:// with path", () => {
    expect(normalizeUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
  });

  it("returns null for empty string", () => {
    expect(normalizeUrl("")).toBeNull();
  });

  it("returns null for non-string", () => {
    expect(normalizeUrl(123)).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(normalizeUrl("not a valid url ://")).toBeNull();
  });
});

describe("stableStringify", () => {
  it("matches JSON.stringify exactly", () => {
    const obj = { b: 2, a: 1, nested: { z: true, y: [1, 2] } };
    expect(stableStringify(obj)).toBe(JSON.stringify(obj));
  });

  it("handles primitives", () => {
    expect(stableStringify("hello")).toBe(JSON.stringify("hello"));
    expect(stableStringify(42)).toBe(JSON.stringify(42));
    expect(stableStringify(null)).toBe(JSON.stringify(null));
  });

  it("handles arrays", () => {
    const arr = [3, 1, { x: "y" }];
    expect(stableStringify(arr)).toBe(JSON.stringify(arr));
  });
});
