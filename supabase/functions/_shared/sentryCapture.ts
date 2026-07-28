/**
 * sentryCapture — Fire-and-forget Sentry event reporter for edge functions.
 *
 * WHAT: Posts a minimal event envelope to Sentry via the DSN's ingest endpoint.
 *       No SDK, no npm import — just fetch. Never throws; on any failure it
 *       swallows the error so the caller's response path is never disturbed.
 * WHERE: Imported by federation-facing edge functions
 *        (federation-signup-ingest, track-click, federation-ga-report,
 *        gardener-campaign-send, federation-orphan-rate-check) inside their
 *        top-level catch blocks.
 * WHY:  Silent edge-function failures were previously invisible outside
 *       function logs. Routing exceptions and orphan-rate anomalies to Sentry
 *       gives the same observability surface that already covers the frontend
 *       (sentry-issues-proxy + Operator UI).
 *
 * Requires SENTRY_DSN env var. If missing, all capture calls no-op.
 */

interface DsnParts {
  publicKey: string;
  host: string;
  projectId: string;
  protocol: string;
}

function parseDsn(dsn: string): DsnParts | null {
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const host = u.host;
    const projectId = u.pathname.replace(/^\//, "");
    if (!publicKey || !host || !projectId) return null;
    return { publicKey, host, projectId, protocol: u.protocol.replace(":", "") };
  } catch {
    return null;
  }
}

function newEventId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

type Level = "error" | "warning" | "info";

interface CaptureOptions {
  level?: Level;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
}

async function sendEnvelope(event: Record<string, unknown>): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  const parts = parseDsn(dsn);
  if (!parts) return;

  const endpoint = `${parts.protocol}://${parts.host}/api/${parts.projectId}/envelope/`;
  const sentAt = new Date().toISOString();
  const header = JSON.stringify({ event_id: event.event_id, sent_at: sentAt, dsn });
  const itemHeader = JSON.stringify({ type: "event" });
  const body = `${header}\n${itemHeader}\n${JSON.stringify(event)}\n`;

  const auth = [
    "Sentry sentry_version=7",
    "sentry_client=cros-edge/1.0",
    `sentry_key=${parts.publicKey}`,
  ].join(", ");

  try {
    // Fire-and-forget with a short timeout so we never block responses.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": auth,
      },
      body,
      signal: controller.signal,
    }).catch(() => undefined);
    clearTimeout(timer);
  } catch {
    // never throw
  }
}

/**
 * Report a caught exception to Sentry. Safe to await or fire-and-forget.
 */
export async function captureEdgeException(
  err: unknown,
  functionName: string,
  opts: CaptureOptions = {},
): Promise<void> {
  const e = err as { message?: string; stack?: string; name?: string };
  const message = e?.message ?? String(err);
  const type = e?.name ?? "Error";
  const stack = typeof e?.stack === "string" ? e.stack : undefined;

  const event = {
    event_id: newEventId(),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: opts.level ?? "error",
    logger: "edge",
    server_name: functionName,
    environment: Deno.env.get("SUPABASE_ENV") ?? "production",
    tags: { function: functionName, runtime: "deno-edge", ...(opts.tags ?? {}) },
    extra: opts.extra ?? {},
    fingerprint: opts.fingerprint,
    exception: {
      values: [
        {
          type,
          value: message,
          stacktrace: stack ? { frames: parseStack(stack) } : undefined,
        },
      ],
    },
  };
  await sendEnvelope(event);
}

/**
 * Report a plain message (e.g. anomaly detected) to Sentry.
 */
export async function captureEdgeMessage(
  message: string,
  functionName: string,
  opts: CaptureOptions = {},
): Promise<void> {
  const event = {
    event_id: newEventId(),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: opts.level ?? "warning",
    logger: "edge",
    server_name: functionName,
    environment: Deno.env.get("SUPABASE_ENV") ?? "production",
    tags: { function: functionName, runtime: "deno-edge", ...(opts.tags ?? {}) },
    extra: opts.extra ?? {},
    fingerprint: opts.fingerprint,
    message: { formatted: message },
  };
  await sendEnvelope(event);
}

// Minimal V8-style stack parser — good enough for Sentry issue grouping.
function parseStack(stack: string): Array<Record<string, unknown>> {
  const lines = stack.split("\n").slice(1);
  const frames: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    const m = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (!m) continue;
    frames.push({
      function: m[1] ?? "?",
      filename: m[2],
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: true,
    });
  }
  // Sentry expects innermost-last order.
  return frames.reverse();
}
