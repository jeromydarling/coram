import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeDomain } from "../domainNormalize.ts";

Deno.test("normalizeDomain: strips protocol + path", () => {
  assertEquals(normalizeDomain("https://WWW.Example.org/about"), "example.org");
});

Deno.test("normalizeDomain: strips www prefix", () => {
  assertEquals(normalizeDomain("www.test.com"), "test.com");
});

Deno.test("normalizeDomain: lowercases", () => {
  assertEquals(normalizeDomain("HTTPS://MyDomain.COM"), "mydomain.com");
});

Deno.test("normalizeDomain: strips query + fragment", () => {
  assertEquals(normalizeDomain("https://site.org/page?q=1#top"), "site.org");
});

Deno.test("normalizeDomain: bare domain", () => {
  assertEquals(normalizeDomain("example.org"), "example.org");
});

Deno.test("normalizeDomain: null input", () => {
  assertEquals(normalizeDomain(null), null);
});

Deno.test("normalizeDomain: empty string", () => {
  assertEquals(normalizeDomain(""), null);
});

Deno.test("normalizeDomain: undefined", () => {
  assertEquals(normalizeDomain(undefined), null);
});

Deno.test("normalizeDomain: preserves subdomain (non-www)", () => {
  assertEquals(normalizeDomain("https://api.example.com/v1"), "api.example.com");
});

Deno.test("normalizeDomain: http protocol", () => {
  assertEquals(normalizeDomain("http://test.org"), "test.org");
});
