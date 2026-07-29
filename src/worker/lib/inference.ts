/**
 * inference — the only path from this Worker to a model (§5.10).
 *
 * Retry and error classification are ported from CROS `llmGateway.ts` at
 * 1ff1e33; that part was sound. What is not ported is where it pointed — the
 * original called a hosted AI gateway, and §5.10 requires `INFERENCE_ENDPOINT`,
 * a private or self-hosted model, by default.
 *
 * Every call goes through `dispatch`, and `dispatch` calls `assertRedacted` on
 * every message before it opens a socket. That check is inside this module
 * rather than left to callers because §3.8 is absolute — "no PII may leave the
 * Worker toward any model endpoint" — and a rule enforced at each call site is
 * a rule that gets forgotten at the eleventh one.
 */

import type { Env } from '../env';
import { assertRedacted } from './redact';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Stable classification, so callers can say something useful when it fails. */
export type FailureKind =
  | 'rate_limited'
  | 'timeout'
  | 'server'
  | 'not_configured'
  | 'bad_response'
  | 'refused'
  | 'unknown';

export type InferenceResult =
  | { ok: true; content: string; attempts: number }
  | { ok: false; kind: FailureKind; detail?: string; attempts: number };

export interface DispatchOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  temperature?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ATTEMPTS = 3;

/**
 * Workers AI model for Scriba.
 *
 * 70B instruct because the job is drafting prose a human will edit — a
 * meeting summary, an agenda, a first pass at a letter. The smaller Llamas are
 * cheaper and noticeably worse at holding a structure across paragraphs, which
 * is most of what this is for.
 */
const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Send messages to the configured model.
 *
 * The redaction check runs over every message, including the system prompt —
 * a prompt assembled from workspace data is exactly as capable of carrying a
 * name as the user's own text, and it is the one people forget.
 */
export async function dispatch(
  env: Env,
  messages: Message[],
  options: DispatchOptions = {},
): Promise<InferenceResult> {
  // Before anything else, including before checking configuration. A misconfigured
  // endpoint must not be the reason we skip the check that matters.
  try {
    for (const message of messages) assertRedacted(message.content);
  } catch (error) {
    return {
      ok: false,
      kind: 'refused',
      detail: error instanceof Error ? error.message : 'Redaction check failed.',
      attempts: 0,
    };
  }

  /*
   * A self-hosted endpoint wins whenever one is configured. §5.10 asks for a
   * private model, and a workspace running its own should keep exactly that;
   * Workers AI is the floor that makes the module work on day one rather than
   * the ceiling.
   */
  const endpoint = env.INFERENCE_ENDPOINT;
  const selfHosted = Boolean(endpoint && !endpoint.startsWith('REPLACE_ME'));

  if (!selfHosted) {
    if (!env.AI) {
      return {
        ok: false,
        kind: 'not_configured',
        detail:
          'No model is available. Set INFERENCE_ENDPOINT for a self-hosted model, or bind ' +
          'Workers AI.',
        attempts: 0,
      };
    }
    return runWorkersAi(env, messages, options);
  }

  const maxAttempts = options.maxAttempts ?? DEFAULT_ATTEMPTS;
  let attempts = 0;
  let lastKind: FailureKind = 'unknown';
  let lastDetail: string | undefined;

  while (attempts < maxAttempts) {
    attempts += 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.INFERENCE_KEY ? { Authorization: `Bearer ${env.INFERENCE_KEY}` } : {}),
        },
        body: JSON.stringify({
          messages,
          temperature: options.temperature ?? 0.3,
          // Stated on every request as well as in the UI (§5.10). A provider
          // that ignores it is the wrong provider, but the request should say
          // so regardless so the expectation is on the record.
          store: false,
          training_opt_out: true,
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        lastKind = 'rate_limited';
      } else if (response.status >= 500) {
        lastKind = 'server';
        lastDetail = `HTTP ${response.status}`;
      } else if (!response.ok) {
        // 4xx other than 429 will not improve on retry.
        return { ok: false, kind: 'bad_response', detail: `HTTP ${response.status}`, attempts };
      } else {
        const body = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          content?: string;
        };
        const content = body.choices?.[0]?.message?.content ?? body.content;

        if (typeof content !== 'string' || !content.trim()) {
          return { ok: false, kind: 'bad_response', detail: 'Empty completion.', attempts };
        }
        return { ok: true, content, attempts };
      }
    } catch (error) {
      lastKind = (error as Error)?.name === 'AbortError' ? 'timeout' : 'unknown';
      lastDetail = (error as Error)?.message;
    } finally {
      clearTimeout(timer);
    }

    if (attempts < maxAttempts) {
      // Exponential backoff. Deliberately not jittered against a private host
      // we are the only caller of — the point here is to let a restarting model
      // server come back, not to spread load across a fleet.
      await sleep(500 * 2 ** (attempts - 1));
    }
  }

  return { ok: false, kind: lastKind, detail: lastDetail, attempts };
}

/** Wording for a failure, for a UI that should not say "error 429". */
export function explain(kind: FailureKind): string {
  switch (kind) {
    case 'rate_limited':
      return 'The model is busy. Try again in a moment.';
    case 'timeout':
      return 'That took too long and was cancelled. Nothing was sent on.';
    case 'server':
      return 'The model host is having trouble. Try again shortly.';
    case 'not_configured':
      return 'No model is connected to this workspace yet.';
    case 'refused':
      return 'That request still contained personal details, so nothing was sent.';
    case 'bad_response':
      return 'The model returned something unusable.';
    default:
      return 'That did not work.';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Workers AI path.
 *
 * Deliberately separate from the HTTP path rather than folded into it. The
 * binding is an RPC call with its own failure shape — no status codes, no
 * Retry-After — and pretending otherwise would mean inventing HTTP semantics
 * to throw away. What the two share is the part that matters: the redaction
 * check already ran in `dispatch`, above both of them.
 */
async function runWorkersAi(
  env: Env,
  messages: Message[],
  options: DispatchOptions,
): Promise<InferenceResult> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_ATTEMPTS;
  let attempts = 0;
  let lastDetail: string | undefined;

  while (attempts < maxAttempts) {
    attempts += 1;

    try {
      const output = (await env.AI!.run(WORKERS_AI_MODEL, {
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: 1024,
      })) as { response?: string };

      const content = output?.response;
      if (typeof content !== 'string' || !content.trim()) {
        return { ok: false, kind: 'bad_response', detail: 'Empty completion.', attempts };
      }
      return { ok: true, content, attempts };
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);

      /*
       * Workers AI answers a busy model with a capacity error rather than a
       * status code, and the same call succeeds a minute later. Anything else
       * — a bad model name, a malformed input — will fail identically on
       * retry, so only capacity is worth waiting out.
       */
      const transient = /capacity|429|5\d\d|could not route|timeout/i.test(lastDetail);
      if (!transient) {
        return { ok: false, kind: 'bad_response', detail: lastDetail, attempts };
      }
      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** (attempts - 1)));
      }
    }
  }

  return { ok: false, kind: 'rate_limited', detail: lastDetail, attempts };
}
