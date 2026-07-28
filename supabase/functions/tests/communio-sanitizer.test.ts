import { assertEquals } from "https://deno.land/std@0.208.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";
import { buildSharedSignal, containsForbiddenData } from "../../../src/lib/communio/buildSharedSignal.ts";

Deno.test("buildSharedSignal - produces sanitized output", () => {
  const result = buildSharedSignal({
    signal_type: "device_demand_increase",
    summary: "Several organizations in this metro are preparing for increased digital access needs.",
    metro_id: "metro-123",
  });

  assert(result !== null);
  assertEquals(result!.signal_type, "device_demand_increase");
  assertEquals(result!.metro_id, "metro-123");
  assert(!result!.signal_summary.includes("@"));
});

Deno.test("buildSharedSignal - strips emails from summary", () => {
  const result = buildSharedSignal({
    signal_type: "trend",
    summary: "Contact john@example.com for details about this program.",
  });

  assert(result !== null);
  assert(!result!.signal_summary.includes("john@example.com"));
  assert(result!.signal_summary.includes("[redacted]"));
});

Deno.test("buildSharedSignal - strips dollar amounts", () => {
  const result = buildSharedSignal({
    signal_type: "funding",
    summary: "Grant of $50,000 was awarded to support digital inclusion.",
  });

  assert(result !== null);
  assert(!result!.signal_summary.includes("$50,000"));
});

Deno.test("buildSharedSignal - rejects signals with forbidden metadata keys", () => {
  const result = buildSharedSignal({
    signal_type: "trend",
    summary: "A community trend was identified.",
    metadata: { email: "test@org.com", org_name: "SecretOrg" },
  });

  assertEquals(result, null);
});

Deno.test("buildSharedSignal - rejects null signal_type", () => {
  const result = buildSharedSignal({
    signal_type: "",
    summary: "Something happened.",
  });

  assertEquals(result, null);
});

Deno.test("buildSharedSignal - rejects too many redactions", () => {
  const result = buildSharedSignal({
    signal_type: "trend",
    summary: "Contact john@a.com, jane@b.com, bob@c.com for details.",
  });

  assertEquals(result, null);
});

Deno.test("containsForbiddenData - detects emails in nested objects", () => {
  const result = containsForbiddenData({
    nested: { deep: { email: "hidden@test.com" } },
  });
  assertEquals(result, true);
});

Deno.test("containsForbiddenData - clean object passes", () => {
  const result = containsForbiddenData({
    signal_type: "trend",
    summary: "Community awareness is growing.",
  });
  assertEquals(result, false);
});
