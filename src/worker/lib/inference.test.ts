import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../env';
import { dispatch, explain, type Message } from './inference';

const HELLO: Message[] = [
  { role: 'system', content: 'Write plainly.' },
  { role: 'user', content: 'Draft a note about the meeting on Tuesday.' },
];

/**
 * A stand-in for the Workers AI binding. Only `run` exists, which is the whole
 * surface this module touches — if it ever reaches for something else, that
 * should fail here rather than in production.
 */
function fakeAi(impl: (model: string, input: unknown) => Promise<unknown>) {
  const calls: Array<{ model: string; input: unknown }> = [];
  return {
    calls,
    binding: {
      run: (model: string, input: unknown) => {
        calls.push({ model, input });
        return impl(model, input);
      },
    },
  };
}

function envWith(over: Partial<Env> = {}): Env {
  return {
    INFERENCE_ENDPOINT: 'REPLACE_ME_private_inference_host',
    ...over,
  } as unknown as Env;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('redaction gate', () => {
  /*
   * The single most important assertion in this file. §3.8 is absolute, and the
   * check has to happen before configuration is even looked at — otherwise a
   * misconfigured endpoint becomes the reason the check was skipped.
   */
  it('refuses before it opens a socket, and does not call the model', async () => {
    const ai = fakeAi(async () => ({ response: 'should never happen' }));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await dispatch(envWith({ AI: ai.binding }), [
      { role: 'user', content: 'Email ada@example.org about it.' },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.kind).toBe('refused');
    expect(result.attempts).toBe(0);
    expect(ai.calls).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('checks the system prompt too, not just the user turn', async () => {
    const ai = fakeAi(async () => ({ response: 'nope' }));

    const result = await dispatch(envWith({ AI: ai.binding }), [
      { role: 'system', content: 'Reply from desk@example.org.' },
      { role: 'user', content: 'Draft a note.' },
    ]);

    expect(result.ok).toBe(false);
    expect(ai.calls).toHaveLength(0);
  });

  /*
   * The error must not echo what it refused. This error gets logged, and a log
   * line containing the PII we just declined to send would defeat the check
   * that produced it.
   */
  it('does not put the offending value in the failure detail', async () => {
    const result = await dispatch(envWith(), [
      { role: 'user', content: 'Call 555-867-5309 tonight.' },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.detail).not.toContain('867');
  });
});

describe('routing', () => {
  it('prefers a self-hosted endpoint over Workers AI when one is configured', async () => {
    const ai = fakeAi(async () => ({ response: 'from workers ai' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ choices: [{ message: { content: 'from my own box' } }] })),
    );

    const result = await dispatch(
      envWith({ INFERENCE_ENDPOINT: 'https://model.example.internal/v1/chat', AI: ai.binding }),
      HELLO,
    );

    expect(result).toMatchObject({ ok: true, content: 'from my own box' });
    // §5.10: a workspace running its own model keeps exactly that.
    expect(ai.calls).toHaveLength(0);
  });

  it('falls back to Workers AI when the endpoint is still a placeholder', async () => {
    const ai = fakeAi(async () => ({ response: 'drafted' }));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await dispatch(envWith({ AI: ai.binding }), HELLO);

    expect(result).toMatchObject({ ok: true, content: 'drafted' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ai.calls[0].model).toMatch(/^@cf\/meta\/llama/);
  });

  it('sends the messages through unchanged', async () => {
    const ai = fakeAi(async () => ({ response: 'ok' }));
    await dispatch(envWith({ AI: ai.binding }), HELLO);

    expect(ai.calls[0].input).toMatchObject({ messages: HELLO });
  });

  /*
   * The bug that made every JSON prompt look like an outage.
   *
   * Workers AI hands back `response` as a string for prose and as an
   * already-parsed object when the completion is valid JSON. The wrapper
   * checked `typeof === 'string'` and reported "Empty completion" for the
   * second case — so a prompt that asked for JSON and got exactly what it asked
   * for was recorded as a failure. The watch list's summaries were missing for
   * this reason and no other, and it looked like documents too thin to
   * summarise rather than like a bug.
   */
  it('re-serialises a JSON completion Workers AI already parsed', async () => {
    const ai = fakeAi(async () => ({ response: { summary: 'Four petitions.', relevance: 88 } }));

    const result = await dispatch(envWith({ AI: ai.binding }), HELLO);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(JSON.parse(result.content)).toEqual({ summary: 'Four petitions.', relevance: 88 });
  });

  it('still treats a genuinely empty answer as a failure', async () => {
    for (const response of ['', '   ', null, undefined]) {
      const ai = fakeAi(async () => ({ response }));
      const result = await dispatch(envWith({ AI: ai.binding }), HELLO);
      expect(result.ok, JSON.stringify(response)).toBe(false);
    }
  });

  it('reports not_configured when there is no model at all', async () => {
    const result = await dispatch(envWith(), HELLO);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.kind).toBe('not_configured');
    expect(result.attempts).toBe(0);
    expect(explain(result.kind)).toBe('No model is connected to this workspace yet.');
  });
});

describe('Workers AI failures', () => {
  it('retries a capacity error and succeeds', async () => {
    let n = 0;
    const ai = fakeAi(async () => {
      n += 1;
      if (n === 1) throw new Error('Capacity temporarily exceeded for this model');
      return { response: 'second time lucky' };
    });

    const result = await dispatch(envWith({ AI: ai.binding }), HELLO);

    expect(result).toMatchObject({ ok: true, content: 'second time lucky', attempts: 2 });
  });

  /*
   * A bad model name or malformed input fails identically on retry. Burning two
   * more calls on it only delays the error the caller needs to see.
   */
  it('does not retry an error that cannot improve', async () => {
    const ai = fakeAi(async () => {
      throw new Error('No such model: @cf/meta/llama-9999');
    });

    const result = await dispatch(envWith({ AI: ai.binding }), HELLO);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.kind).toBe('bad_response');
    expect(result.attempts).toBe(1);
    expect(ai.calls).toHaveLength(1);
  });

  it('treats an empty completion as unusable rather than as success', async () => {
    const ai = fakeAi(async () => ({ response: '   ' }));

    const result = await dispatch(envWith({ AI: ai.binding }), HELLO);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.kind).toBe('bad_response');
  });

  it('gives up after the attempt budget and says why', async () => {
    const ai = fakeAi(async () => {
      throw new Error('capacity');
    });

    const result = await dispatch(envWith({ AI: ai.binding }), HELLO, { maxAttempts: 2 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.kind).toBe('rate_limited');
    expect(result.attempts).toBe(2);
    expect(ai.calls).toHaveLength(2);
  });
});

describe('explain', () => {
  it('never surfaces a status code to a person', () => {
    const kinds = [
      'rate_limited',
      'timeout',
      'server',
      'not_configured',
      'bad_response',
      'refused',
      'unknown',
    ] as const;

    for (const kind of kinds) {
      const text = explain(kind);
      expect(text).not.toMatch(/\b(4\d\d|5\d\d)\b/);
      expect(text.endsWith('.')).toBe(true);
    }
  });
});
