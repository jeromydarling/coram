/**
 * edgeFunctionMetrics — Client-side helper to invoke edge functions with
 * automatic correlation ID threading and performance tracking.
 *
 * WHAT: Wraps supabase.functions.invoke() with correlation + timing.
 * WHERE: Use instead of raw supabase.functions.invoke() for traced calls.
 * WHY: Enables request tracing and latency visibility across the platform.
 */
import { supabase } from '@/integrations/supabase/client';
import { handleRateLimitResponse } from '@/lib/rateLimitHandler';

interface TracedInvokeOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** Friendly name for rate-limit toasts */
  friendlyAction?: string;
}

interface TracedResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
  correlationId: string;
  durationMs: number;
}

/**
 * Invoke an edge function with automatic correlation ID and timing.
 */
export async function tracedInvoke<T = unknown>(
  functionName: string,
  options: TracedInvokeOptions = {}
): Promise<TracedResult<T>> {
  const correlationId = crypto.randomUUID();
  const start = performance.now();

  const result = await supabase.functions.invoke(functionName, {
    body: options.body,
    headers: {
      ...options.headers,
      'x-correlation-id': correlationId,
    },
  });

  const durationMs = Math.round(performance.now() - start);

  // Handle rate limiting
  if (options.friendlyAction) {
    handleRateLimitResponse(result as any, options.friendlyAction);
  }

  return {
    data: result.data as T | null,
    error: result.error ? { message: result.error.message } : null,
    correlationId,
    durationMs,
  };
}
