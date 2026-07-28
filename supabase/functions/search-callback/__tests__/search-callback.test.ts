import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Fixtures ──
const VALID_RUN_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const SEARCH_SECRET = "search-test-secret";
const ENRICHMENT_SECRET = "enrichment-test-secret";

const VALID_BRIEF = {
  summary: "Found 3 relevant contacts in the Denver metro area.",
  what_we_found: ["Executive Director at TechCorp", "Board member at DigitalEquity Foundation"],
  what_may_be_missing: ["No community college contacts found"],
  helpful_sites: [{ name: "LinkedIn", url: "https://linkedin.com", why: "Professional network for contact discovery" }],
  suggested_queries: ["digital equity leadership Denver", "broadband nonprofit staff Colorado"],
  confidence: 0.75,
  caveats: ["Results limited to public web pages"],
};

const VALID_COMPLETED = {
  run_id: VALID_RUN_ID,
  status: "completed",
  results: [
    {
      title: "Tech Conference 2026",
      description: "Annual tech conference",
      url: "https://example.com/event",
      location: "Denver, CO",
      organization: "TechCorp",
      confidence: 0.85,
    },
    {
      title: "Digital Summit",
      url: "https://example.com/summit",
      confidence: 0.6,
    },
  ],
};

const VALID_COMPLETED_WITH_BRIEF = {
  ...VALID_COMPLETED,
  brief: VALID_BRIEF,
};

const VALID_COMPLETED_NULL_BRIEF = {
  ...VALID_COMPLETED,
  brief: null,
};

const VALID_FAILED = {
  run_id: VALID_RUN_ID,
  status: "failed",
  error_message: "Search provider timeout",
};

const INVALID_BRIEF_MISSING_SUMMARY = {
  run_id: VALID_RUN_ID,
  status: "completed",
  results: [],
  brief: {
    what_we_found: [],
    what_may_be_missing: [],
    helpful_sites: [],
    suggested_queries: [],
    caveats: [],
  },
};

const INVALID_BRIEF_NOT_OBJECT = {
  run_id: VALID_RUN_ID,
  status: "completed",
  results: [],
  brief: "not an object",
};

const INVALID_BRIEF_MISSING_ARRAYS = {
  run_id: VALID_RUN_ID,
  status: "completed",
  results: [],
  brief: {
    summary: "test",
    what_we_found: "not array",
  },
};

// ── Setup helper ──
function setSecrets(opts: { search?: string; enrichment?: string }) {
  try { Deno.env.delete("SEARCH_WORKER_SECRET"); } catch { /* ok */ }
  try { Deno.env.delete("ENRICHMENT_WORKER_SECRET"); } catch { /* ok */ }
  if (opts.search) Deno.env.set("SEARCH_WORKER_SECRET", opts.search);
  if (opts.enrichment) Deno.env.set("ENRICHMENT_WORKER_SECRET", opts.enrichment);
}

// Set defaults for validateBody tests
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

// Import after env setup
import { validateBody, validateBrief } from "../index.ts";

// ═══════════════════════════════════════
// validateBody tests
// ═══════════════════════════════════════

Deno.test("validateBody: valid completed payload passes", () => {
  const result = validateBody(VALID_COMPLETED);
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.run_id, VALID_RUN_ID);
    assertEquals(result.data.status, "completed");
    assertEquals(result.data.results?.length, 2);
  }
});

Deno.test("validateBody: valid failed payload passes", () => {
  const result = validateBody(VALID_FAILED);
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.status, "failed");
    assertEquals(result.data.error_message, "Search provider timeout");
  }
});

Deno.test("validateBody: null body fails", () => {
  const result = validateBody(null);
  assertEquals(result.valid, false);
});

Deno.test("validateBody: missing run_id fails", () => {
  const result = validateBody({ status: "completed", results: [] });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("run_id"), true);
  }
});

Deno.test("validateBody: invalid run_id fails", () => {
  const result = validateBody({ run_id: "not-a-uuid", status: "completed", results: [] });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("run_id"), true);
  }
});

Deno.test("validateBody: invalid status fails", () => {
  const result = validateBody({ run_id: VALID_RUN_ID, status: "unknown" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("status"), true);
  }
});

Deno.test("validateBody: failed without error_message fails", () => {
  const result = validateBody({ run_id: VALID_RUN_ID, status: "failed" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("error_message"), true);
  }
});

Deno.test("validateBody: completed without results fails", () => {
  const result = validateBody({ run_id: VALID_RUN_ID, status: "completed" });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("results"), true);
  }
});

Deno.test("validateBody: result without title fails", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    results: [{ description: "No title" }],
  });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("title"), true);
  }
});

Deno.test("validateBody: result with empty title fails", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    results: [{ title: "  " }],
  });
  assertEquals(result.valid, false);
});

Deno.test("validateBody: completed with empty results array passes", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    results: [],
  });
  assertEquals(result.valid, true);
});

Deno.test("validateBody: multiple results with varying fields pass", () => {
  const result = validateBody({
    run_id: VALID_RUN_ID,
    status: "completed",
    results: [
      { title: "Event A", confidence: 0.9, location: "NYC" },
      { title: "Event B" },
      { title: "Event C", url: "https://example.com", organization: "Org" },
    ],
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.results?.length, 3);
  }
});

// ═══════════════════════════════════════
// Brief validation tests
// ═══════════════════════════════════════

Deno.test("validateBody: completed with valid brief passes", () => {
  const result = validateBody(VALID_COMPLETED_WITH_BRIEF);
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.brief?.summary, VALID_BRIEF.summary);
    assertEquals(result.data.brief?.what_we_found.length, 2);
    assertEquals(result.data.brief?.helpful_sites.length, 1);
    assertEquals(result.data.brief?.confidence, 0.75);
  }
});

Deno.test("validateBody: completed with null brief passes", () => {
  const result = validateBody(VALID_COMPLETED_NULL_BRIEF);
  assertEquals(result.valid, true);
});

Deno.test("validateBody: completed without brief field passes", () => {
  const result = validateBody(VALID_COMPLETED);
  assertEquals(result.valid, true);
});

Deno.test("validateBody: brief missing summary fails", () => {
  const result = validateBody(INVALID_BRIEF_MISSING_SUMMARY);
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("brief.summary"), true);
  }
});

Deno.test("validateBody: brief not object fails", () => {
  const result = validateBody(INVALID_BRIEF_NOT_OBJECT);
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("brief"), true);
  }
});

Deno.test("validateBody: brief missing required arrays fails", () => {
  const result = validateBody(INVALID_BRIEF_MISSING_ARRAYS);
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("brief.what_we_found"), true);
  }
});

Deno.test("validateBrief: null returns valid", () => {
  const result = validateBrief(null);
  assertEquals(result.valid, true);
});

Deno.test("validateBrief: undefined returns valid", () => {
  const result = validateBrief(undefined);
  assertEquals(result.valid, true);
});

Deno.test("validateBrief: valid brief returns valid", () => {
  const result = validateBrief(VALID_BRIEF);
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.data.summary, VALID_BRIEF.summary);
  }
});

Deno.test("validateBrief: missing caveats fails", () => {
  const result = validateBrief({
    summary: "test",
    what_we_found: [],
    what_may_be_missing: [],
    helpful_sites: [],
    suggested_queries: [],
    // missing caveats
  });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.error.includes("caveats"), true);
  }
});
