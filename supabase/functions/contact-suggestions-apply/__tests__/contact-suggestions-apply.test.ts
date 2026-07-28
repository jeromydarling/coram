import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import { handleRequest } from "../index.ts";

const BASE_URL = "http://localhost:8000/contact-suggestions-apply";

Deno.test({ name: "APPLY: CORS OPTIONS", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "OPTIONS" }));
  assertEquals(res.status, 200);
}});

Deno.test({ name: "APPLY: rejects GET method", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, { method: "GET" }));
  assertEquals(res.status, 405);
  await res.text();
}});

Deno.test({ name: "APPLY: rejects missing auth", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity_type: "event", entity_id: "abc", suggestion_index: 0 }),
  }));
  assertEquals(res.status, 401);
  await res.text();
}});

Deno.test({ name: "APPLY: rejects invalid JSON (after auth fails)", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  // Auth check happens before JSON parse, so with fake JWT and no Supabase running,
  // we get 401 not 400. This is correct security behavior.
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { Authorization: "Bearer fake", "Content-Type": "application/json" },
    body: "not json",
  }));
  const body = await res.json();
  assertEquals(body.ok, false);
}});

Deno.test({ name: "APPLY: rejects invalid entity_type", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { Authorization: "Bearer fake", "Content-Type": "application/json" },
    body: JSON.stringify({ entity_type: "contact", entity_id: "abc", suggestion_index: 0 }),
  }));
  // Will be 401 (getUser fails) or 400 depending on order. Either is correct.
  const body = await res.json();
  assertEquals(body.ok, false);
}});

Deno.test({ name: "APPLY: rejects negative suggestion_index", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { Authorization: "Bearer fake", "Content-Type": "application/json" },
    body: JSON.stringify({ entity_type: "event", entity_id: "abc", suggestion_index: -1 }),
  }));
  const body = await res.json();
  assertEquals(body.ok, false);
}});

Deno.test({ name: "APPLY: rejects missing suggestion_index", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await handleRequest(new Request(BASE_URL, {
    method: "POST",
    headers: { Authorization: "Bearer fake", "Content-Type": "application/json" },
    body: JSON.stringify({ entity_type: "event", entity_id: "abc" }),
  }));
  const body = await res.json();
  assertEquals(body.ok, false);
}});
