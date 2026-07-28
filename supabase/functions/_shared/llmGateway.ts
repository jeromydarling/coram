/**
 * Shared Lovable AI gateway client for all worker edge functions.
 * Uses google/gemini-2.5-flash by default (fast, cheap, good for extraction).
 * Uses google/gemini-3-flash-preview for complex reasoning tasks.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmTool {
  type: "function";
  function: LlmToolFunction;
}

export interface LlmOptions {
  model?: string;
  temperature?: number;
  tools?: LlmTool[];
  tool_choice?: { type: "function"; function: { name: string } };
  timeoutMs?: number;
  /** Max attempts including the first call. Defaults to 3. Retries on 429/5xx/network. */
  maxAttempts?: number;
}

/** Stable classification of why an LLM call failed — used by callers for calm fallback copy. */
export type LlmErrorKind =
  | "rate_limited"      // 429
  | "payment_required"  // 402
  | "timeout"
  | "server"            // 5xx
  | "config"            // missing key
  | "bad_response"      // malformed JSON / no choices
  | "unknown";

export interface LlmResult {
  ok: boolean;
  content?: string;
  toolCall?: { name: string; arguments: Record<string, unknown> };
  error?: string;
  status?: number;
  errorKind?: LlmErrorKind;
  attempts?: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call the Lovable AI gateway. Returns parsed content or tool call result.
 */
export async function callLlm(
  messages: LlmMessage[],
  options: LlmOptions = {},
): Promise<LlmResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY not configured", errorKind: "config" };

  const model = options.model || "google/gemini-2.5-flash";
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.1,
  };
  if (options.tools) {
    body.tools = options.tools;
    if (options.tool_choice) body.tool_choice = options.tool_choice;
  }

  const timeoutMs = options.timeoutMs || 30_000;
  const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 3));

  let lastErr: LlmResult = { ok: false, error: "no attempts", errorKind: "unknown" };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const status = resp.status;
        const errorKind: LlmErrorKind =
          status === 429 ? "rate_limited"
            : status === 402 ? "payment_required"
            : status >= 500 ? "server"
            : "unknown";
        lastErr = {
          ok: false,
          error: `AI gateway ${status}: ${errText.slice(0, 500)}`,
          status,
          errorKind,
          attempts: attempt,
        };
        // Retry only on 429 / 5xx, not on 402 or 4xx config errors.
        if ((status === 429 || status >= 500) && attempt < maxAttempts) {
          const retryAfter = Number(resp.headers.get("retry-after")) || 0;
          const backoff = retryAfter > 0
            ? retryAfter * 1000
            : Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
          await sleep(backoff);
          continue;
        }
        return lastErr;
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      if (!choice) {
        return { ok: false, error: "No choices in AI response", errorKind: "bad_response", attempts: attempt };
      }

      const toolCall = choice.message?.tool_calls?.[0];
      if (toolCall?.function) {
        const args = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        return { ok: true, toolCall: { name: toolCall.function.name, arguments: args }, attempts: attempt };
      }

      const content = choice.message?.content ?? "";
      return { ok: true, content, attempts: attempt };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.toLowerCase().includes("timeout") || (err as { name?: string })?.name === "TimeoutError";
      lastErr = {
        ok: false,
        error: `LLM call failed: ${msg}`,
        errorKind: isTimeout ? "timeout" : "unknown",
        attempts: attempt,
      };
      if (attempt < maxAttempts) {
        await sleep(Math.min(8000, 500 * 2 ** (attempt - 1)));
        continue;
      }
      return lastErr;
    }
  }

  return lastErr;
}

/**
 * Call LLM expecting JSON response (parses from content).
 */
export async function callLlmJson<T = Record<string, unknown>>(
  messages: LlmMessage[],
  options: LlmOptions = {},
): Promise<{ ok: boolean; data?: T; error?: string; errorKind?: LlmErrorKind; status?: number }> {
  const result = await callLlm(messages, options);
  if (!result.ok) return { ok: false, error: result.error, errorKind: result.errorKind, status: result.status };

  if (result.toolCall) {
    return { ok: true, data: result.toolCall.arguments as T };
  }

  const content = result.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return { ok: true, data: JSON.parse(arrayMatch[0]) as T };
      } catch {
        return { ok: false, error: "Failed to parse JSON array from LLM response", errorKind: "bad_response" };
      }
    }
    return { ok: false, error: "No JSON found in LLM response", errorKind: "bad_response" };
  }

  try {
    return { ok: true, data: JSON.parse(jsonMatch[0]) as T };
  } catch {
    return { ok: false, error: "Failed to parse JSON from LLM response", errorKind: "bad_response" };
  }
}

/**
 * Human-facing calm fallback copy for a failed LLM call. Callers should use
 * this on AI-generated UI surfaces instead of surfacing raw error strings.
 */
export function calmFallbackMessage(kind?: LlmErrorKind): string {
  switch (kind) {
    case "rate_limited":
      return "The narrative engine is resting briefly. We'll try again shortly.";
    case "payment_required":
      return "AI capacity is paused for this workspace. A steward can review usage in Settings.";
    case "timeout":
      return "The reflection is taking longer than expected. We'll keep listening.";
    case "server":
      return "The narrative engine is briefly unavailable. Please try again in a moment.";
    case "config":
      return "AI is not configured for this workspace yet.";
    default:
      return "We couldn't reach the narrative engine just now.";
  }
}
