/**
 * queryCounts — Browser-side helpers for reading error counts/issues from Sentry.
 *
 * WHAT: Thin wrappers over the `sentry-issues-proxy` edge function. The Sentry auth
 *       token is server-only, so the browser never talks to Sentry directly.
 * WHERE: Used by the operator awareness surfaces (Vigilia, Analytics, Rhythm) and
 *        the Compass session engine that previously read `system_error_events`.
 * WHY: `system_error_events` was retired; Sentry is now the source of truth for
 *      platform errors. These helpers degrade silently (return 0 / []) on any
 *      failure so awareness UI never crashes when Sentry is unconfigured.
 */
import { supabase } from '@/integrations/supabase/client';

interface SentryCountResponse {
  count?: number;
  _sentry_unconfigured?: boolean;
}

/**
 * Count error events seen in Sentry within the last `sinceHoursAgo` hours,
 * optionally scoped to a federation `appSlug` and/or `tenantId` tag.
 * Returns 0 on any failure (silent) — callers treat this as "no friction".
 */
export async function getSentryErrorCount(opts: {
  sinceHoursAgo: number;
  appSlug?: string;
  tenantId?: string;
}): Promise<number> {
  try {
    const since = new Date(Date.now() - opts.sinceHoursAgo * 3_600_000).toISOString();
    const { data, error } = await supabase.functions.invoke<SentryCountResponse>(
      'sentry-issues-proxy',
      {
        body: {
          op: 'count',
          since,
          ...(opts.appSlug ? { app_slug: opts.appSlug } : {}),
          ...(opts.tenantId ? { tenant_id: opts.tenantId } : {}),
        },
      },
    );
    if (error || !data) return 0;
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export interface SentryRecentIssue {
  id: string;
  message: string;
  route: string | null;
}

interface SentryIssuesResponse {
  issues?: Array<{
    id: string;
    message: string;
    context?: { route?: string | null };
  }>;
}

/**
 * Fetch up to `limit` most-recent open issues for a federation `appSlug`.
 * Used by the Compass overlay (which previously read per-tenant error rows).
 * Returns [] on any failure or when Sentry is unconfigured.
 */
export async function getSentryRecentIssues(opts: {
  appSlug: string;
  limit?: number;
}): Promise<SentryRecentIssue[]> {
  try {
    const { data, error } = await supabase.functions.invoke<SentryIssuesResponse>(
      'sentry-issues-proxy',
      {
        body: {
          status: 'open',
          app_slug: opts.appSlug,
          limit: opts.limit ?? 3,
        },
      },
    );
    if (error || !data?.issues) return [];
    return data.issues.slice(0, opts.limit ?? 3).map((i) => ({
      id: i.id,
      message: i.message,
      route: i.context?.route ?? null,
    }));
  } catch {
    return [];
  }
}
