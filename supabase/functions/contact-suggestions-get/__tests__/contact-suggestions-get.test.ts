import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

import { handleRequest } from "../index.ts";

const BASE_URL = "http://localhost:8000/contact-suggestions-get";

Deno.test({ name: "GET rejects OPTIONS without error", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "OPTIONS" }));
  assertEquals(res.status, 200);
}});

Deno.test({ name: "GET rejects POST method", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { Authorization: "Bearer test" },
  }));
  assertEquals(res.status, 405);
  await res.text();
}});

Deno.test({ name: "GET rejects missing auth", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "GET" }));
  assertEquals(res.status, 401);
  await res.text();
}});

Deno.test({ name: "GET rejects missing entity_type", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(`${BASE_URL}?entity_id=abc`, {
    method: "GET",
    headers: { Authorization: "Bearer fake-jwt" },
  }));
  const body = await res.json();
  assertEquals(body.ok, false);
}});

Deno.test({ name: "GET rejects invalid entity_type param", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(`${BASE_URL}?entity_type=contact&entity_id=abc`, {
    method: "GET",
    headers: { Authorization: "Bearer fake-jwt" },
  }));
  const body = await res.json();
  assertEquals(body.ok, false);
}});

Deno.test({ name: "GET rejects missing entity_id", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(`${BASE_URL}?entity_type=event`, {
    method: "GET",
    headers: { Authorization: "Bearer fake-jwt" },
  }));
  const body = await res.json();
  assertEquals(body.ok, false);
}});
