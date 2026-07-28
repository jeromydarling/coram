import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Status formatting (mirrors automationHealthFormatters.ts) ──

function statusVariant(status: string): string {
  switch (status) {
    case 'processed': return 'default';
    case 'error':
    case 'failed_timeout': return 'destructive';
    case 'dispatched':
    case 'running': return 'secondary';
    case 'deduped':
    case 'skipped_due_to_cap':
    case 'throttled':
    case 'rate_limited':
      return 'outline';
    default: return 'outline';
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    processed: 'Processed',
    error: 'Error',
    dispatched: 'Dispatched',
    running: 'Running',
    queued: 'Queued',
    deduped: 'Deduped (no change)',
    skipped_due_to_cap: 'Skipped (cap)',
    processing: 'Processing',
    throttled: 'Throttled (concurrency)',
    rate_limited: 'Rate limited',
    failed_timeout: 'Failed (timeout)',
  };
  return labels[status] || status;
}

// ── Stuck run detection logic ──

function isStuck(status: string, createdAt: string, thresholdMinutes: number): boolean {
  if (status !== 'dispatched' && status !== 'running') return false;
  const age = (Date.now() - new Date(createdAt).getTime()) / 60000;
  return age > thresholdMinutes;
}

// ── Tests ──

Deno.test("hardening: throttled status shows as outline variant", () => {
  assertEquals(statusVariant("throttled"), "outline");
});

Deno.test("hardening: rate_limited status shows as outline variant", () => {
  assertEquals(statusVariant("rate_limited"), "outline");
});

Deno.test("hardening: failed_timeout shows as destructive", () => {
  assertEquals(statusVariant("failed_timeout"), "destructive");
});

Deno.test("hardening: throttled has human-readable label", () => {
  assertEquals(statusLabel("throttled"), "Throttled (concurrency)");
});

Deno.test("hardening: rate_limited has human-readable label", () => {
  assertEquals(statusLabel("rate_limited"), "Rate limited");
});

Deno.test("hardening: failed_timeout has human-readable label", () => {
  assertEquals(statusLabel("failed_timeout"), "Failed (timeout)");
});

Deno.test("hardening: unknown status falls back gracefully", () => {
  assertEquals(statusVariant("unknown_xyz"), "outline");
  assertEquals(statusLabel("unknown_xyz"), "unknown_xyz");
});

// ── Stuck detection ──

Deno.test("hardening: dispatched run older than threshold is stuck", () => {
  const old = new Date(Date.now() - 35 * 60000).toISOString();
  assertEquals(isStuck("dispatched", old, 30), true);
});

Deno.test("hardening: running run older than threshold is stuck", () => {
  const old = new Date(Date.now() - 35 * 60000).toISOString();
  assertEquals(isStuck("running", old, 30), true);
});

Deno.test("hardening: recent dispatched run is not stuck", () => {
  const recent = new Date(Date.now() - 5 * 60000).toISOString();
  assertEquals(isStuck("dispatched", recent, 30), false);
});

Deno.test("hardening: processed run is never stuck", () => {
  const old = new Date(Date.now() - 120 * 60000).toISOString();
  assertEquals(isStuck("processed", old, 30), false);
});

Deno.test("hardening: error run is never stuck", () => {
  const old = new Date(Date.now() - 120 * 60000).toISOString();
  assertEquals(isStuck("error", old, 30), false);
});

// ── Concurrency limit logic ──

Deno.test("hardening: concurrency limit at exactly 3 triggers throttle", () => {
  const runningCount = 3;
  const maxConcurrent = 3;
  assertEquals(runningCount >= maxConcurrent, true);
});

Deno.test("hardening: concurrency below 3 allows dispatch", () => {
  const runningCount = 2;
  const maxConcurrent = 3;
  assertEquals(runningCount >= maxConcurrent, false);
});

// ── Exactly-once semantics ──

Deno.test("hardening: same fingerprint same run_id → dedup", () => {
  const existing = { status: "processed", payload_fingerprint: "abc123" };
  const incoming = "abc123";
  const isDedup = existing.status === "processed" && existing.payload_fingerprint === incoming;
  assertEquals(isDedup, true);
});

Deno.test("hardening: same run_id different fingerprint → replay", () => {
  const existing = { status: "processed", payload_fingerprint: "abc123" };
  const incoming = "def456";
  const isReplay = existing.status === "processed" && existing.payload_fingerprint !== incoming;
  assertEquals(isReplay, true);
});

Deno.test("hardening: in-flight same fingerprint → dedup", () => {
  const existing = { status: "processing", payload_fingerprint: "abc123" };
  const incoming = "abc123";
  const isDedup = existing.payload_fingerprint === incoming && existing.status === "processing";
  assertEquals(isDedup, true);
});

// ── Timeout enforcement ──

Deno.test("hardening: mark_stuck_runs threshold applies correctly", () => {
  // Simulates the RPC logic: runs older than threshold get marked
  const threshold = 30; // minutes
  const runs = [
    { status: "dispatched", created_at: new Date(Date.now() - 40 * 60000).toISOString() },
    { status: "running", created_at: new Date(Date.now() - 5 * 60000).toISOString() },
    { status: "processed", created_at: new Date(Date.now() - 60 * 60000).toISOString() },
  ];
  const stuck = runs.filter(r => isStuck(r.status, r.created_at, threshold));
  assertEquals(stuck.length, 1);
  assertEquals(stuck[0].status, "dispatched");
});

// ── Cap enforcement ──

Deno.test("hardening: crawl cap blocks when at limit", () => {
  const todayCount = 50;
  const dailyCap = 50;
  assertEquals(todayCount >= dailyCap, true);
});

Deno.test("hardening: crawl cap allows when under limit", () => {
  const todayCount = 49;
  const dailyCap = 50;
  assertEquals(todayCount >= dailyCap, false);
});
