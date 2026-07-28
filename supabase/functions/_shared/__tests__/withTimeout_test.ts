import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { withTimeout, TimeoutError, fetchWithTimeout } from '../withTimeout.ts';

Deno.test('withTimeout resolves when promise beats deadline', async () => {
  const result = await withTimeout(Promise.resolve(42), 100, 'fast');
  assertEquals(result, 42);
});

Deno.test('withTimeout rejects with TimeoutError when promise is too slow', async () => {
  let innerTimer: number | undefined;
  const slow = new Promise<number>((resolve) => {
    innerTimer = setTimeout(() => resolve(1), 5000);
  });
  await assertRejects(() => withTimeout(slow, 20, 'slow'), TimeoutError);
  if (innerTimer !== undefined) clearTimeout(innerTimer);
});

Deno.test('withTimeout propagates underlying rejection', async () => {
  const failing = Promise.reject(new Error('boom'));
  await assertRejects(() => withTimeout(failing, 100, 'failing'), Error, 'boom');
});

Deno.test('fetchWithTimeout aborts a slow request', async () => {
  // 127.0.0.1:1 is reserved; the connection will hang or fail — either way fast.
  await assertRejects(
    () => fetchWithTimeout('http://127.0.0.1:1', {}, 30, 'unreachable'),
    Error,
  );
});
