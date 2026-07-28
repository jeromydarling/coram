import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createLogger } from '../withLogger.ts';

function captureStdout(fn: () => void): string[] {
  const original = console.log;
  const captured: string[] = [];
  console.log = (msg: unknown) => captured.push(String(msg));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return captured;
}

Deno.test('createLogger reuses inbound x-request-id', () => {
  const req = new Request('https://x.test/', { headers: { 'x-request-id': 'abc12345' } });
  const log = createLogger(req, 'my-fn');
  assertEquals(log.requestId, 'abc12345');
});

Deno.test('createLogger mints request id when none provided', () => {
  const req = new Request('https://x.test/');
  const log = createLogger(req, 'my-fn');
  assertEquals(typeof log.requestId, 'string');
  assertEquals(log.requestId.length > 0, true);
});

Deno.test('logger.info emits structured JSON with request_id + fn', () => {
  const req = new Request('https://x.test/', { headers: { 'x-request-id': 'trace01' } });
  const log = createLogger(req, 'my-fn');
  const lines = captureStdout(() => log.info('hello', { rows: 3 }));
  assertEquals(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assertEquals(parsed.level, 'info');
  assertEquals(parsed.fn, 'my-fn');
  assertEquals(parsed.request_id, 'trace01');
  assertEquals(parsed.msg, 'hello');
  assertEquals(parsed.rows, 3);
  assertStringIncludes(parsed.ts, 'T');
});
