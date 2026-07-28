import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ── Set env BEFORE importing ──
Deno.env.set("ENRICHMENT_WORKER_SECRET", "test_enrich_secret");
Deno.env.set("N8N_SHARED_SECRET", "test_shared_secret");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

import { authenticateWorkerRequest, constantTimeCompare, jsonOk, jsonError } from "../_shared/workerAuth.ts";

const BASE_URL = "http://localhost/worker";

// ── constantTimeCompare ──

Deno.test("constantTimeCompare: equal strings", () => {
  assertEquals(constantTimeCompare("abc", "abc"), true);
});

Deno.test("constantTimeCompare: unequal strings", () => {
  assertEquals(constantTimeCompare("abc", "abd"), false);
});

Deno.test("constantTimeCompare: different lengths", () => {
  assertEquals(constantTimeCompare("ab", "abc"), false);
});

Deno.test("constantTimeCompare: empty strings", () => {
  assertEquals(constantTimeCompare("", ""), true);
});

// ── authenticateWorkerRequest ──

Deno.test("workerAuth: rejects missing token", () => {
  const req = new Request(BASE_URL, { method: "POST" });
  assertEquals(authenticateWorkerRequest(req), false);
});

Deno.test("workerAuth: accepts service role key via Bearer", () => {
  const req = new Request(BASE_URL, {
    method: "POST",
    headers: { "authorization": "Bearer test-service-role-key" },
  });
  assertEquals(authenticateWorkerRequest(req), true);
});

Deno.test("workerAuth: accepts enrichment worker secret via x-api-key", () => {
  const req = new Request(BASE_URL, {
    method: "POST",
    headers: { "x-api-key": "test_enrich_secret" },
  });
  assertEquals(authenticateWorkerRequest(req), true);
});

Deno.test("workerAuth: accepts n8n shared secret via Bearer", () => {
  const req = new Request(BASE_URL, {
    method: "POST",
    headers: { "authorization": "Bearer test_shared_secret" },
  });
  assertEquals(authenticateWorkerRequest(req), true);
});

Deno.test("workerAuth: rejects invalid token", () => {
  const req = new Request(BASE_URL, {
    method: "POST",
    headers: { "x-api-key": "wrong_secret" },
  });
  assertEquals(authenticateWorkerRequest(req), false);
});

Deno.test("workerAuth: rejects empty Bearer", () => {
  const req = new Request(BASE_URL, {
    method: "POST",
    headers: { "authorization": "Bearer " },
  });
  assertEquals(authenticateWorkerRequest(req), false);
});

// ── jsonOk ──

Deno.test("jsonOk: returns 200 with JSON body", async () => {
  const resp = jsonOk({ ok: true, count: 5 });
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.ok, true);
  assertEquals(body.count, 5);
});

Deno.test("jsonOk: custom status", async () => {
  const resp = jsonOk({ ok: true }, 201);
  assertEquals(resp.status, 201);
  await resp.text(); // consume
});

// ── jsonError ──

Deno.test("jsonError: returns error envelope", async () => {
  const resp = jsonError(400, "BAD_REQUEST", "Missing field");
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.ok, false);
  assertEquals(body.error, "BAD_REQUEST");
  assertEquals(body.message, "Missing field");
});

Deno.test("jsonError: CORS headers present", () => {
  const resp = jsonError(401, "UNAUTHORIZED", "No auth");
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
});
