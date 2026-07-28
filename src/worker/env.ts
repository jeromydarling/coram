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

  // Async jobs.
  Q_PURGE: Queue<PurgeMessage>;

  // Static assets for the SPA under /app.
  ASSETS: Fetcher;

  // Vars.
  ENVIRONMENT: 'development' | 'production';
  INFERENCE_ENDPOINT: string;
  CANARY_PUBKEY_FINGERPRINT: string;

  // Secrets.
  AUTH_JWT_SECRET: string;
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
export type PurgeMessage =
  | { kind: 'burn.r2'; tenantId: string; bucket: 'files' | 'exports'; cursor?: string }
  | { kind: 'retention.sweep'; table: string };

/** Hono's context variables, set by middleware. */
export interface Vars {
  requestId: string;
  session?: import('./lib/auth').Session;
}
