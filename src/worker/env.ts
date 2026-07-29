/**
 * Worker bindings. Mirrors wrangler.toml; keep the two in step.
 */

export interface Env {
  // Postgres behind Hyperdrive, as coram_app. RLS applies.
  HYPERDRIVE: Hyperdrive;
  // Same database as coram_cron, which has BYPASSRLS. Cron and queue
  // consumers only — never reachable from a request handler.
  HYPERDRIVE_CRON: Hyperdrive;

  // Edge state.
  KV_SESSIONS: KVNamespace;
  KV_FLAGS: KVNamespace;
  KV_RATE: KVNamespace;

  // Object storage.
  R2_FILES: R2Bucket;
  R2_EXPORTS: R2Bucket;
  /**
   * Marketing photography (§8.2), generated at build time and served under
   * /media. Public by definition and holds nothing tenant-scoped, which is why
   * it is a separate bucket from R2_FILES — a bucket that serves unauthenticated
   * bytes should not be one that also holds a workspace's uploads.
   */
  R2_MEDIA: R2Bucket;

  // Async jobs.
  Q_PURGE: Queue<PurgeMessage>;
  Q_SEND: Queue<SendMessage>;

  // Durable Objects.
  //   DO_DIAL   phone bank queue (§5.4)
  //   DO_BALLOT  live tallies (§5.8)
  //   DO_CHANNEL sealed message delivery (§5.7) — the only copy of ciphertext
  DO_DIAL: DurableObjectNamespace;
  DO_BALLOT: DurableObjectNamespace;
  DO_CHANNEL: DurableObjectNamespace;

  // Static assets for the SPA under /app.
  ASSETS: Fetcher;

  // Vars.
  ENVIRONMENT: 'development' | 'production';
  INFERENCE_ENDPOINT: string;
  CANARY_PUBKEY_FINGERPRINT: string;

  // Secrets.
  AUTH_JWT_SECRET: string;
  /**
   * Peppers the opt-out ledger's identifier hashes (§5.4). Kept out of
   * Postgres on purpose, so a database disclosure cannot test whether a given
   * address is suppressed. Rotating it orphans every existing suppression —
   * it is not a routine rotation.
   */
  SUPPRESSION_PEPPER: string;
  FEDERATION_STRIPE_SECRET?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  INFERENCE_KEY?: string;
}

/**
 * Work the burn switch and the nightly sweep hand off to a queue because it
 * cannot finish inside a request. Postgres rows go synchronously — cascading
 * one DELETE is fast — but R2 listing and deletion is paginated and unbounded,
 * so it runs here.
 */
/** Delivery work for Nuntius (§5.4). */
export type SendMessage =
  | { kind: 'campaign'; campaignId: string; cursor?: string }
  | { kind: 'p2p'; conversationId: string; messageId: string }
  /**
   * One voting link per eligible member (§5.8). Carries no tokens — the job
   * cannot re-derive them, which is the point: they exist once, in the request
   * that minted them, and are handed straight to delivery.
   */
  | { kind: 'ballot_tokens'; ballotId: string };

export type PurgeMessage =
  | { kind: 'burn.r2'; tenantId: string; bucket: 'files' | 'exports'; cursor?: string }
  | { kind: 'retention.sweep'; table: string };

/** Hono's context variables, set by middleware. */
export interface Vars {
  requestId: string;
  session?: import('./lib/auth').Session;
  /**
   * The request's Postgres client, created on first use by `db()` and closed
   * once by middleware after the handler returns. Handlers must not close it:
   * doing so eagerly is what broke every database route in the first live
   * deploy. See src/worker/lib/db.ts.
   */
  sql?: import('./lib/rls').Sql;
}
