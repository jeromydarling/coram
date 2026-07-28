import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("DENO_TEST", "1");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

import { parseParams } from "../index.ts";

// ── parseParams tests ──

Deno.test("parseParams: valid people module", () => {
  const url = new URL("http://localhost/search-history?module=people&days=7");
  const result = parseParams(url);
  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.module, "people");
    assertEquals(result.days, 7);
  }
});

Deno.test("parseParams: valid events module", () => {
  const url = new URL("http://localhost/search-history?module=events");
  const result = parseParams(url);
  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.module, "events");
    assertEquals(result.days, 30);
  }
});

Deno.test("parseParams: valid grants module", () => {
  const url = new URL("http://localhost/search-history?module=grants&days=15");
  const result = parseParams(url);
  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.module, "grants");
    assertEquals(result.days, 15);
  }
});

Deno.test("parseParams: missing module fails", () => {
  const url = new URL("http://localhost/search-history");
  const result = parseParams(url);
  assertEquals("error" in result, true);
});

Deno.test("parseParams: invalid module fails", () => {
  const url = new URL("http://localhost/search-history?module=invalid");
  const result = parseParams(url);
  assertEquals("error" in result, true);
});

Deno.test("parseParams: days capped at 30", () => {
  const url = new URL("http://localhost/search-history?module=people&days=90");
  const result = parseParams(url);
  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.days, 30);
  }
});

Deno.test("parseParams: negative days defaults to 30", () => {
  const url = new URL("http://localhost/search-history?module=people&days=-5");
  const result = parseParams(url);
  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.days, 30);
  }
});

Deno.test("parseParams: non-numeric days defaults to 30", () => {
  const url = new URL("http://localhost/search-history?module=people&days=abc");
  const result = parseParams(url);
  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.days, 30);
  }
});
