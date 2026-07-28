/**
 * Queue consumer for destructive work that cannot finish inside a request.
 *
 * The burn switch deletes Postgres rows synchronously — one cascading DELETE
 * is fast and the §3.5 sixty-second promise depends on it. R2 is different:
 * listing a bucket is paginated and unbounded, so it continues here.
 */

import type { Env, PurgeMessage } from '../env';

/**
 * R2 keys are laid out tenant-first so a workspace's objects can be found by
 * prefix. Every module writing to R2 must follow this, or the burn switch will
 * miss its files.
 */
export function tenantPrefix(tenantId: string): string {
  return `t/${tenantId}/`;
}

/** R2 delete accepts up to 1000 keys per call. */
const DELETE_BATCH = 1000;

export async function handlePurge(batch: MessageBatch<PurgeMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      if (message.body.kind === 'burn.r2') {
        await purgeBucket(env, message.body);
      }
      message.ack();
    } catch (error) {
      console.error('purge job failed', message.body, error);
      // Retry with backoff. After max_retries the message lands in
      // coram-purge-dlq, where leftover objects are a real problem worth
      // alerting on — a burn that left files behind has broken its promise.
      message.retry();
    }
  }
}

async function purgeBucket(
  env: Env,
  msg: Extract<PurgeMessage, { kind: 'burn.r2' }>,
): Promise<void> {
  const bucket = msg.bucket === 'files' ? env.R2_FILES : env.R2_EXPORTS;
  const prefix = tenantPrefix(msg.tenantId);

  let cursor = msg.cursor;
  do {
    const listed = await bucket.list({ prefix, cursor, limit: DELETE_BATCH });
    if (listed.objects.length) {
      await bucket.delete(listed.objects.map((o) => o.key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;

    // Re-enqueue rather than loop forever inside one invocation: a bucket with
    // a very large number of objects would otherwise hit the consumer's CPU
    // limit and retry the whole thing from the start.
    if (cursor && listed.objects.length === DELETE_BATCH) {
      await env.Q_PURGE.send({ ...msg, cursor });
      return;
    }
  } while (cursor);
}
