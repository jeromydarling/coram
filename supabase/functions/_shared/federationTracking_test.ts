import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  base64UrlDecode,
  base64UrlEncode,
  emailHash,
  isFederationAppUrl,
  rewriteHtmlForTracking,
  appendUtmParams,
} from "./federationTracking.ts";

Deno.test("emailHash normalizes case and whitespace", async () => {
  const a = await emailHash("  Ada@Example.com ");
  const b = await emailHash("ada@example.com");
  assertEquals(a, b);
});

Deno.test("base64url roundtrip", () => {
  const s = "https://propria.land/?x=1&y=hello world";
  assertEquals(base64UrlDecode(base64UrlEncode(s)), s);
});

Deno.test("isFederationAppUrl recognizes Propria domains", () => {
  assert(isFederationAppUrl("https://propria.land/join", "propria"));
  assert(isFederationAppUrl("https://www.propria.land/", "propria"));
  assert(isFederationAppUrl("https://propria.lovable.app/x", "propria"));
  assert(!isFederationAppUrl("https://google.com", "propria"));
  assert(!isFederationAppUrl("not a url", "propria"));
});

Deno.test("appendUtmParams adds cros_sid + defaults", () => {
  const out = appendUtmParams("https://propria.land/join", { campaign_id: "camp-1", send_id: "send-1" });
  assertStringIncludes(out, "utm_source=cros_federation");
  assertStringIncludes(out, "utm_campaign=camp-1");
  assertStringIncludes(out, "cros_sid=send-1");
});

Deno.test("appendUtmParams keeps user-specified utm_source", () => {
  const out = appendUtmParams("https://propria.land/?utm_source=custom", { campaign_id: "c", send_id: "s" });
  assertStringIncludes(out, "utm_source=custom");
  assertStringIncludes(out, "cros_sid=s");
});

Deno.test("rewriteHtmlForTracking rewrites <a> and adds pixel", () => {
  const html = `<html><body>Hi <a href="https://example.com/x">click me</a></body></html>`;
  const out = rewriteHtmlForTracking({
    html,
    sendId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    campaignId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    federationAppSlug: "propria",
    supabaseUrl: "https://x.supabase.co",
    disclosePixel: false,
  });
  assertStringIncludes(out, "/functions/v1/track-click?sid=");
  assertStringIncludes(out, "/functions/v1/track-open?sid=");
  assert(!out.includes(`href="https://example.com/x"`));
});

Deno.test("rewriteHtmlForTracking appends UTMs on federation-app links", () => {
  const html = `<a href="https://propria.land/join">join</a>`;
  const out = rewriteHtmlForTracking({
    html,
    sendId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    campaignId: "camp-uuid",
    federationAppSlug: "propria",
    supabaseUrl: "https://x.supabase.co",
    disclosePixel: false,
  });
  // Extract encoded destination, decode, verify UTMs are present
  const m = out.match(/track-click\?sid=[^&]+&u=([^"']+)/);
  assert(m, "expected tracked link");
  const decoded = base64UrlDecode(decodeURIComponent(m![1]));
  assertStringIncludes(decoded, "utm_source=cros_federation");
  assertStringIncludes(decoded, "cros_sid=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
});

Deno.test("rewriteHtmlForTracking skips mailto/tel/anchor/javascript", () => {
  const html = `<a href="mailto:a@b.com">m</a><a href="tel:555">t</a><a href="#top">a</a><a href="javascript:alert(1)">js</a>`;
  const out = rewriteHtmlForTracking({
    html, sendId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", campaignId: "c",
    federationAppSlug: "propria", supabaseUrl: "https://x.supabase.co", disclosePixel: false,
  });
  assert(!out.includes("track-click"));
});
