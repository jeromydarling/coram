/**
 * correlationId — Request tracing utility.
 *
 * WHAT: Generates and propagates correlation IDs for request tracing.
 * WHERE: Used by edge functions to thread a trace ID through logs and metrics.
 * WHY: Enables end-to-end request tracing across edge function chains.
 */

/**
 * Extract or generate a correlation ID from a request.
 * Checks x-correlation-id header first, falls back to crypto.randomUUID().
 */
export function getCorrelationId(req: Request): string {
  return req.headers.get('x-correlation-id') ?? crypto.randomUUID();
}

/**
 * Add correlation ID to response headers.
 */
export function withCorrelationHeader(
  headers: Record<string, string>,
  correlationId: string
): Record<string, string> {
  return { ...headers, 'x-correlation-id': correlationId };
}
