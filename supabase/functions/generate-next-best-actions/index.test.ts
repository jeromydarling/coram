import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

async function callFn(name: string, body: unknown = {}, headers: Record<string, string> = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: resp.status, json };
}

// ============ generate-next-best-actions ============

Deno.test("generate-next-best-actions: rejects unauthenticated", async () => {
  const { status } = await callFn("generate-next-best-actions");
  // anon key won't pass worker check → falls to getUser → 401
  if (status !== 401) throw new Error(`Expected 401, got ${status}`);
});

Deno.test("generate-next-best-actions: rejects GET", async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-next-best-actions`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
  });
  await resp.text();
  if (resp.status !== 405) throw new Error(`Expected 405, got ${resp.status}`);
});

// ============ detect-priority-moments ============

Deno.test("detect-priority-moments: rejects unauthenticated", async () => {
  const { status } = await callFn("detect-priority-moments");
  if (status !== 401) throw new Error(`Expected 401, got ${status}`);
});

Deno.test("detect-priority-moments: rejects GET", async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/detect-priority-moments`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
  });
  await resp.text();
  if (resp.status !== 405) throw new Error(`Expected 405, got ${resp.status}`);
});

// ============ monitor-automation-health ============

Deno.test("monitor-automation-health: rejects invalid auth", async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/monitor-automation-health`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: "{}",
  });
  await resp.text();
  if (resp.status !== 401) throw new Error(`Expected 401, got ${resp.status}`);
});

Deno.test("monitor-automation-health: OPTIONS returns CORS", async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/monitor-automation-health`, {
    method: "OPTIONS",
  });
  await resp.text();
  if (resp.status !== 200 && resp.status !== 204) throw new Error(`Expected 200/204, got ${resp.status}`);
});
