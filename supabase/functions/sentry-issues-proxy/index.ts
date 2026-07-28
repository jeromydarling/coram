/**
 * sentry-issues-proxy — Server-side proxy to the Sentry Issues API.
 *
 * WHAT: Reads SENTRY_AUTH_TOKEN (server-only secret) and queries Sentry for the
 *       org's issues, normalizing them into the shape the Error Desk consumes.
 *       Also supports a write path (mark resolved / ignored / unresolved).
 * WHERE: Called from the operator Error Desk via supabase.functions.invoke.
 * WHY: The Sentry auth token must never reach the browser; Error Desk now treats
 *      Sentry as the source of truth for platform errors (replaces operator_app_errors).
 *
 * GET-style (body) params:
 *   status   open | resolved | ignored      → is:unresolved | is:resolved | is:ignored
 *   app_slug satellite slug                  → app_slug:<slug> tag filter
 *   query    free-text search                → appended to the Sentry query
 *   limit    default 50, max 200
 *   cursor   Sentry pagination cursor
 *
 * POST write params (action present):
 *   action   resolve | ignore | unresolve
 *   issue_id Sentry issue id (numeric or short id)
 *
 * Count params (op === "count"):
 *   op        "count"
 *   since     ISO timestamp — lower bound; converted to a Sentry statsPeriod
 *   app_slug  optional satellite slug → app_slug:<slug> tag filter
 *   tenant_id optional tenant uuid    → tenant_id:<uuid> tag filter
 *             NOTE: events are not yet tagged with tenant_id at capture time, so a
 *             tenant_id filter currently matches nothing and returns count 0. This
 *             is intentional graceful degradation — wire tenant_id tagging into the
 *             Sentry SDK scope before relying on this filter for precision.
 *   Approach: sum issue.count over the unresolved issues matching the window/tags
 *             (one issues-list call). Simpler than events-stats and accurate enough
 *             for the operator's "events in the last N hours" cards. Tradeoff: caps
 *             at limit=100 issues per window, which is far above normal volume.
 *   Returns: { count: number }. Missing/invalid token → { count: 0, _sentry_unconfigured: true }.
 *
 * Returns: { issues, next_cursor, prev_cursor } on read,
 *          { ok: true, status } on write,
 *          { count } on count.
 * Sentry 401/403 → 502 { error: "sentry_auth", message } on read/write;
 *                  → { count: 0, _sentry_unconfigured: true } on count (callers degrade).
 */
import { getCorsHeaders, handleCorsPreflightResponse } from "../_shared/cors.ts";

const SENTRY_ORG = "cros-llc";
const SENTRY_API = `https://sentry.io/api/0`;
const CACHE_TTL_MS = 30_000;
const COUNT_CACHE_TTL_MS = 60_000;

type IssueStatus = "open" | "resolved" | "ignored";

interface NormalizedIssue {
  id: string;
  source: "sentry";
  severity: "low" | "medium" | "high";
  fingerprint: string;
  message: string;
  context: {
    route: string | null;
    function_name: string | null;
    app_slug: string | null;
    environment: string | null;
    release: string | null;
    platform: string | null;
  };
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: string;
  sentry_url: string | null;
  owner_notes: null;
  lovable_prompt: null;
}

interface SentryIssue {
  id: string;
  shortId?: string;
  title?: string;
  culprit?: string;
  permalink?: string;
  count?: string | number;
  firstSeen?: string;
  lastSeen?: string;
  level?: string;
  status?: string;
  platform?: string;
  metadata?: Record<string, unknown>;
  tags?: Array<{ key: string; value: string }>;
}

// In-memory 30s cache keyed by the resolved query string.
const cache = new Map<string, { at: number; body: unknown }>();

function statusToQuery(status: IssueStatus): string {
  switch (status) {
    case "resolved":
      return "is:resolved";
    case "ignored":
      return "is:ignored";
    case "open":
    default:
      return "is:unresolved";
  }
}

function mapSeverity(level?: string): "low" | "medium" | "high" {
  switch ((level || "").toLowerCase()) {
    case "fatal":
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "info":
    case "debug":
    default:
      return "low";
  }
}

function tagValue(issue: SentryIssue, key: string): string | null {
  const t = issue.tags?.find((t) => t.key === key);
  return t?.value ?? null;
}

function normalizeIssue(issue: SentryIssue): NormalizedIssue {
  const meta = issue.metadata ?? {};
  return {
    id: issue.id,
    source: "sentry",
    severity: mapSeverity(issue.level),
    fingerprint: `${issue.culprit ?? ""}|${issue.shortId ?? issue.id}`,
    message: issue.title ?? (meta.value as string) ?? "Unknown issue",
    context: {
      route: tagValue(issue, "route") ?? tagValue(issue, "transaction"),
      function_name: tagValue(issue, "function_name") ?? (issue.culprit ?? null),
      app_slug: tagValue(issue, "app_slug"),
      environment: tagValue(issue, "environment"),
      release: tagValue(issue, "release"),
      platform: issue.platform ?? tagValue(issue, "platform"),
    },
    count: Number(issue.count ?? 0),
    first_seen_at: issue.firstSeen ?? new Date(0).toISOString(),
    last_seen_at: issue.lastSeen ?? new Date(0).toISOString(),
    status: issue.status ?? "unresolved",
    sentry_url: issue.permalink ?? null,
    owner_notes: null,
    lovable_prompt: null,
  };
}

// Parse the RFC-5988 Link header Sentry returns for cursor pagination.
function parseCursors(linkHeader: string | null): {
  next: string | null;
  prev: string | null;
} {
  if (!linkHeader) return { next: null, prev: null };
  let next: string | null = null;
  let prev: string | null = null;
  for (const part of linkHeader.split(",")) {
    const cursorMatch = part.match(/cursor="([^"]+)"/);
    const resultsMatch = part.match(/results="([^"]+)"/);
    if (!cursorMatch) continue;
    const cursor = cursorMatch[1];
    const hasResults = !resultsMatch || resultsMatch[1] === "true";
    if (part.includes('rel="next"')) next = hasResults ? cursor : null;
    if (part.includes('rel="previous"')) prev = hasResults ? cursor : null;
  }
  return { next, prev };
}

// Convert an ISO "since" lower bound into the coarse statsPeriod Sentry accepts.
// Sentry's issues endpoint takes statsPeriod (e.g. "24h", "7d"), not an absolute
// timestamp, so we round the elapsed window UP to the nearest supported bucket.
function sinceToStatsPeriod(sinceIso: string | undefined): string {
  if (!sinceIso) return "24h";
  const since = Date.parse(sinceIso);
  if (Number.isNaN(since)) return "24h";
  const hours = (Date.now() - since) / 3_600_000;
  if (hours <= 1) return "1h";
  if (hours <= 24) return "24h";
  if (hours <= 24 * 7) return "7d";
  if (hours <= 24 * 14) return "14d";
  return "90d";
}

async function handleCount(
  req: Request,
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const cors = getCorsHeaders(req);
  const since = typeof body.since === "string" ? body.since : undefined;
  const appSlug = typeof body.app_slug === "string" ? body.app_slug : "";
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
  const statsPeriod = sinceToStatsPeriod(since);

  const queryParts = ["is:unresolved"];
  if (appSlug && appSlug !== "all") queryParts.push(`app_slug:${appSlug}`);
  if (tenantId) queryParts.push(`tenant_id:${tenantId}`);
  const query = queryParts.join(" ");

  const url = new URL(`${SENTRY_API}/organizations/${SENTRY_ORG}/issues/`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "100");
  url.searchParams.set("statsPeriod", statsPeriod);

  const cacheKey = `count|${url.toString()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < COUNT_CACHE_TTL_MS) {
    return new Response(JSON.stringify(cached.body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Count callers must never crash — degrade to 0 on any auth/API failure.
  if (res.status === 401 || res.status === 403) {
    return new Response(
      JSON.stringify({ count: 0, _sentry_unconfigured: true }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
  if (!res.ok) {
    return new Response(
      JSON.stringify({ count: 0 }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const raw = (await res.json()) as SentryIssue[];
  const count = raw.reduce((sum, issue) => sum + Number(issue.count ?? 0), 0);
  const responseBody = { count };

  cache.set(cacheKey, { at: Date.now(), body: responseBody });
  return new Response(JSON.stringify(responseBody), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleRead(
  req: Request,
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const cors = getCorsHeaders(req);
  const status = (body.status as IssueStatus) || "open";
  const appSlug = typeof body.app_slug === "string" ? body.app_slug : "";
  const freeText = typeof body.query === "string" ? body.query : "";
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
  const cursor = typeof body.cursor === "string" ? body.cursor : "";

  const queryParts = [statusToQuery(status)];
  if (appSlug && appSlug !== "all") queryParts.push(`app_slug:${appSlug}`);
  if (freeText.trim()) queryParts.push(freeText.trim());
  const query = queryParts.join(" ");

  const url = new URL(`${SENTRY_API}/organizations/${SENTRY_ORG}/issues/`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("statsPeriod", "90d");
  if (cursor) url.searchParams.set("cursor", cursor);

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cached.body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    const message = await res.text();
    return new Response(
      JSON.stringify({ error: "sentry_auth", message }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
  if (!res.ok) {
    const message = await res.text();
    return new Response(
      JSON.stringify({ error: "sentry_error", status: res.status, message }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const raw = (await res.json()) as SentryIssue[];
  const { next, prev } = parseCursors(res.headers.get("Link"));
  const responseBody = {
    issues: raw.map(normalizeIssue),
    next_cursor: next,
    prev_cursor: prev,
  };

  cache.set(cacheKey, { at: Date.now(), body: responseBody });
  return new Response(JSON.stringify(responseBody), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleWrite(
  req: Request,
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const cors = getCorsHeaders(req);
  const action = body.action as string;
  const issueId = body.issue_id as string;

  if (!issueId) {
    return new Response(
      JSON.stringify({ error: "bad_request", message: "issue_id required" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Map Error Desk actions to Sentry issue status values.
  const sentryStatus =
    action === "resolve"
      ? "resolved"
      : action === "ignore"
      ? "ignored"
      : action === "unresolve"
      ? "unresolved"
      : null;

  if (!sentryStatus) {
    return new Response(
      JSON.stringify({ error: "bad_request", message: `unknown action: ${action}` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const res = await fetch(
    `${SENTRY_API}/organizations/${SENTRY_ORG}/issues/${issueId}/`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: sentryStatus }),
    },
  );

  if (res.status === 401 || res.status === 403) {
    const message = await res.text();
    return new Response(
      JSON.stringify({ error: "sentry_auth", message }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
  if (!res.ok) {
    const message = await res.text();
    return new Response(
      JSON.stringify({ error: "sentry_error", status: res.status, message }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Mutating writes invalidate the read cache so the desk reflects new state.
  cache.clear();
  return new Response(JSON.stringify({ ok: true, status: sentryStatus }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightResponse(req);
  const cors = getCorsHeaders(req);

  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") body = await req.json();
  } catch {
    body = {};
  }

  const token = Deno.env.get("SENTRY_AUTH_TOKEN");
  if (!token) {
    // Count callers degrade gracefully rather than surfacing a 502.
    if (body.op === "count") {
      return new Response(
        JSON.stringify({ count: 0, _sentry_unconfigured: true }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        error: "sentry_auth",
        message:
          "SENTRY_AUTH_TOKEN not configured. Set it in Supabase Edge Function secrets.",
      }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  try {
    if (body.op === "count") return await handleCount(req, token, body);
    if (body.action) return await handleWrite(req, token, body);
    return await handleRead(req, token, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "proxy_error", message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
