/**
 * sentry-issue-detail — Fetches the latest event for a single Sentry issue.
 *
 * WHAT: Reads SENTRY_AUTH_TOKEN and returns the latest event's stack frames and
 *       breadcrumbs for an issue, normalized for the Error Desk detail drawer.
 * WHERE: Called from ErrorDetailDrawer via supabase.functions.invoke when a row opens.
 * WHY: The drawer builds a Lovable fix prompt from real Sentry stack/breadcrumb data;
 *      the auth token must stay server-side.
 *
 * POST body: { id: string }  — Sentry issue id (numeric or short id)
 * Returns: { event } where event holds a flattened stack excerpt + breadcrumbs,
 *          plus a `context` block shaped like the Error Desk record context.
 * Sentry 401/403 → 502 { error: "sentry_auth", message }.
 */
import { getCorsHeaders, handleCorsPreflightResponse } from "../_shared/cors.ts";

const SENTRY_API = `https://sentry.io/api/0`;

interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  in_app?: boolean;
}

interface SentryEntry {
  type: string;
  data: Record<string, unknown>;
}

interface SentryEvent {
  id?: string;
  eventID?: string;
  title?: string;
  culprit?: string;
  platform?: string;
  dateCreated?: string;
  tags?: Array<{ key: string; value: string }>;
  entries?: SentryEntry[];
}

function tagValue(event: SentryEvent, key: string): string | null {
  return event.tags?.find((t) => t.key === key)?.value ?? null;
}

// Flatten the latest exception's in-app frames into a compact stack excerpt.
function buildStackExcerpt(event: SentryEvent): string {
  const exceptionEntry = event.entries?.find((e) => e.type === "exception");
  if (!exceptionEntry) return "";
  const values = (exceptionEntry.data?.values as Array<Record<string, unknown>>) || [];
  const lines: string[] = [];
  for (const val of values) {
    const type = val.type as string | undefined;
    const message = val.value as string | undefined;
    if (type || message) lines.push(`${type ?? "Error"}: ${message ?? ""}`);
    const frames =
      ((val.stacktrace as Record<string, unknown>)?.frames as StackFrame[]) || [];
    // Sentry orders frames bottom-up; show the most recent in-app frames first.
    const relevant = frames.filter((f) => f.in_app !== false).slice(-8).reverse();
    for (const f of relevant) {
      lines.push(
        `    at ${f.function ?? "?"} (${f.filename ?? "?"}:${f.lineno ?? "?"})`,
      );
    }
  }
  return lines.join("\n").slice(0, 2000);
}

function buildBreadcrumbs(event: SentryEvent): Array<Record<string, unknown>> {
  const crumbEntry = event.entries?.find((e) => e.type === "breadcrumbs");
  if (!crumbEntry) return [];
  const values = (crumbEntry.data?.values as Array<Record<string, unknown>>) || [];
  return values.slice(-15).map((c) => ({
    timestamp: c.timestamp,
    category: c.category,
    level: c.level,
    message: c.message,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightResponse(req);
  const cors = getCorsHeaders(req);

  const token = Deno.env.get("SENTRY_AUTH_TOKEN");
  if (!token) {
    return new Response(
      JSON.stringify({
        error: "sentry_auth",
        message:
          "SENTRY_AUTH_TOKEN not configured. Set it in Supabase Edge Function secrets.",
      }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") body = await req.json();
  } catch {
    body = {};
  }

  const id = body.id as string;
  if (!id) {
    return new Response(
      JSON.stringify({ error: "bad_request", message: "id required" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  try {
    const res = await fetch(
      `${SENTRY_API}/issues/${id}/events/latest/`,
      { headers: { Authorization: `Bearer ${token}` } },
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

    const event = (await res.json()) as SentryEvent;
    const normalized = {
      id: event.eventID ?? event.id ?? id,
      title: event.title ?? "",
      culprit: event.culprit ?? "",
      platform: event.platform ?? null,
      date_created: event.dateCreated ?? null,
      stack_excerpt: buildStackExcerpt(event),
      breadcrumbs: buildBreadcrumbs(event),
      context: {
        route: tagValue(event, "route") ?? tagValue(event, "transaction"),
        function_name: tagValue(event, "function_name") ?? (event.culprit ?? null),
        app_slug: tagValue(event, "app_slug"),
        environment: tagValue(event, "environment"),
        release: tagValue(event, "release"),
        platform: event.platform ?? null,
      },
    };

    return new Response(JSON.stringify({ event: normalized }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "proxy_error", message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
