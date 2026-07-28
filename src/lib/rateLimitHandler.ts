/**
 * rateLimitHandler — Centralized rate-limit error handling for edge function calls.
 *
 * WHAT: Detects 429 responses and shows user-friendly toast with retry guidance.
 * WHERE: Wrap any supabase.functions.invoke() call.
 * WHY: Edge functions return 429 when rate limited, but the UI silently swallowed these.
 */
import { toast } from 'sonner';

interface InvokeResult {
  data: unknown;
  error: { message: string; status?: number } | null;
}

/**
 * Wraps an edge function invocation and surfaces rate-limit errors to the user.
 * Returns the original result so callers can still handle other errors.
 */
export function handleRateLimitResponse(
  result: InvokeResult,
  friendlyAction = 'This action'
): InvokeResult {
  if (result.error) {
    const status = (result.error as any).status ?? (result.error as any).context?.status;
    const msg = result.error.message?.toLowerCase() ?? '';

    if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
      toast.warning(`${friendlyAction} is temporarily limited. Please wait a moment and try again.`, {
        id: `rate-limit-${friendlyAction}`,
        duration: 8000,
      });
    }
  }
  return result;
}

/**
 * Check a raw fetch Response for 429 and show toast. Returns true if rate limited.
 */
export function isRateLimited(response: Response, friendlyAction = 'This action'): boolean {
  if (response.status === 429) {
    toast.warning(`${friendlyAction} is temporarily limited. Please wait a moment and try again.`, {
      id: `rate-limit-${friendlyAction}`,
      duration: 8000,
    });
    return true;
  }
  return false;
}
