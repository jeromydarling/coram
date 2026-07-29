import { describe, expect, it } from 'vitest';

import app from '../../index';
import type { Env } from '../../env';

/**
 * Every /api group must refuse an unauthenticated caller with 401.
 *
 * The brand routes shipped without `requireWorkspace` and answered anonymous
 * requests with a 500 — the session was absent, withTenant threw, and an
 * internal fault stood in for "sign in". A 500 on an auth path is worse than
 * untidy: it is indistinguishable from a broken server, and it tells an
 * unauthenticated caller that their request reached the database layer.
 *
 * This enumerates the mounted groups so a new one cannot be added without
 * either declaring a guard or deliberately editing this list.
 */
const PRIVATE_PATHS = [
  '/api/workspace',
  '/api/contacts',
  '/api/events',
  '/api/campaigns',
  '/api/funds',
  '/api/vinculum',
  '/api/consilium',
  '/api/custos',
  '/api/scriba',
  '/api/federatio',
  '/api/exports/contacts.csv',
  '/api/brand',
  '/api/brand/flyer.svg?headline=a&when=b&where=c',
];

const env = {
  KV_SESSIONS: { get: async () => null },
  KV_FLAGS: { get: async () => null },
  KV_RATE: { get: async () => null, put: async () => undefined },
  ENVIRONMENT: 'development',
} as unknown as Env;

/*
 * The default export is the Worker handler, not the Hono app, so this goes in
 * through fetch() — the same door production traffic uses. A stub ctx is
 * enough: nothing on the unauthenticated path should reach waitUntil.
 */
const ctx = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

describe('unauthenticated API access', () => {
  it.each(PRIVATE_PATHS)('%s answers 401, never 500', async (path) => {
    const res = await app.fetch(new Request(`https://coram.test${path}`), env, ctx);
    expect(res.status).toBe(401);
  });
});
