import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Shared module unit tests ──

import { normalizeFirecrawlUrl } from "../_shared/firecrawlClient.ts";

Deno.test("normalizeFirecrawlUrl: adds https://", () => {
  assertEquals(normalizeFirecrawlUrl("example.com"), "https://example.com/");
});

Deno.test("normalizeFirecrawlUrl: preserves https://", () => {
  assertEquals(normalizeFirecrawlUrl("https://example.com"), "https://example.com/");
});

Deno.test("normalizeFirecrawlUrl: preserves http://", () => {
  assertEquals(normalizeFirecrawlUrl("http://example.com"), "http://example.com/");
});

Deno.test("normalizeFirecrawlUrl: trims whitespace", () => {
  assertEquals(normalizeFirecrawlUrl("  example.com  "), "https://example.com/");
});

Deno.test("normalizeFirecrawlUrl: handles paths", () => {
  assertEquals(normalizeFirecrawlUrl("example.com/about"), "https://example.com/about");
});

Deno.test("normalizeFirecrawlUrl: handles invalid URL gracefully", () => {
  // Should return as-is with https:// prefix for invalid URLs
  const result = normalizeFirecrawlUrl("");
  assertEquals(typeof result, "string");
});
