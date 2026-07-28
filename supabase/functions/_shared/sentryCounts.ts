/**
 * sentryCounts — Deno/edge helper for reading error counts from Sentry.
 *
 * WHAT: Server-to-server wrapper that calls the `sentry-issues-proxy` edge function
 *       and returns an error-event count. The proxy holds SENTRY_AUTH_TOKEN; this
 *       helper only needs SUPABASE_URL + a bearer key to reach it.
 * WHERE: Used by edge crons (e.g. operator-analytics-refresh) that previously
 *        counted rows in the retired `system_error_events` table.
 * WHY: This is the Deno-runtime sibling of src/lib/sentry/queryCounts.ts. The two
 *      runtimes can't share a module, so the small fetch is intentionally duplicated.
 *      Both degrade to 0 on any failure so rollups/awareness never break.
 */

/**
 * Count error events seen in Sentry within the last `sinceHoursAgo` hours,
 * optionally scoped to a federation `appSlug` tag. Returns 0 on any failure.
 */
export async function getSentryErrorCount(opts: {
  sinceHoursAgo: number;
  appSlug?: string;
  tenantId?: string;
}): Promise<number> {
  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const key =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!baseUrl || !key) return 0;

    const since = new Date(
      Date.now() - opts.sinceHoursAgo * 3_600_000,
    ).toISOString();

    const res = await fetch(`${baseUrl}/functions/v1/sentry-issues-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({
        op: "count",
        since,
        ...(opts.appSlug ? { app_slug: opts.appSlug } : {}),
        ...(opts.tenantId ? { tenant_id: opts.tenantId } : {}),
      }),
    });

    if (!res.ok) return 0;
    const data = (await res.json()) as { count?: number };
    return data.count ?? 0;
  } catch {
    return 0;
  }
}
