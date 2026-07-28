/**
 * operator-error — Deprecated edge-function error capture helper.
 *
 * WHAT: Previously logged structured errors to the operator_app_errors table.
 *       That table is retired; Sentry is now the source of truth for errors.
 * WHERE: Was imported in catch blocks of edge functions (no current importers).
 * WHY: Kept as a no-op with its original signature so any lingering import keeps
 *      compiling. New code should rely on Sentry instrumentation instead.
 *
 * @deprecated No-op. Errors now flow to Sentry; this writes nothing.
 */

interface EdgeErrorPayload {
  functionName: string;
  message: string;
  runId?: string;
  requestId?: string;
  dbCode?: string;
  stack?: string;
  tenantId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function logOperatorError(_payload: EdgeErrorPayload): Promise<void> {
  // Intentionally a no-op — operator_app_errors was retired in favor of Sentry.
}
