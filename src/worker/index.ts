/**
 * Coram — the whole thing. One Worker: marketing, API, webhooks, cron, queues.
 *
 * §1.5: one repo, one Worker, one deploy. Routing is by path prefix (§1.1):
 *
 *   /                  marketing, public
 *   /trust             transparency artifacts, public
 *   /canary.txt        PGP-signed warrant canary, text/plain
 *   /.well-known/*     security.txt, PGP key
 *   /api/*             Hono API, authenticated
 *   /webhooks/*        signature-verified, no session
 *   /app/*             the SPA shell
 */

import { Hono } from 'hono';

import type { Env, PurgeMessage, Vars } from './env';
import { attachSession } from './lib/auth';
import { ERROR, err, requestId } from './lib/http';
import { TenancyError } from './lib/rls';
import { checkCanaryAge } from './cron/canary';
import { runRetentionSweep } from './cron/purge';
import { handlePurge } from './jobs/purge';
import { auth } from './routes/api/auth';
import { marketing } from './routes/marketing';
import { workspace } from './routes/api/workspace';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use('*', async (c, next) => {
  c.set('requestId', requestId(c.req.raw));
  await next();
  c.header('x-request-id', c.get('requestId'));

  // Same-origin by construction, so these are cheap and unconditional.
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
});

app.use('/api/*', attachSession);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.route('/api/auth', auth);
app.route('/api/workspace', workspace);

app.get('/api/health', (c) => c.json({ ok: true, environment: c.env.ENVIRONMENT }));

/**
 * The SPA shell. Everything under /app is the same document; React Router
 * resolves the rest on the client.
 *
 * §10 forbids analytics and third-party scripts here, and §8.4 forbids motion.
 * Both are properties of what we serve, not of this line — but this is the line
 * that decides what gets served, so it is worth saying here.
 */
app.get('/app/*', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/index.html';
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
});

// Marketing last: its '/' would otherwise shadow the prefixes above.
app.route('/', marketing);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

app.notFound((c) =>
  c.req.path.startsWith('/api/')
    ? c.json(err('No such endpoint.', ERROR.NOT_FOUND, c.get('requestId')), 404)
    : c.text('Not found', 404),
);

app.onError((error, c) => {
  const rid = c.get('requestId');

  if (error instanceof TenancyError) {
    return c.json(err(error.message, ERROR.FORBIDDEN, rid), 403);
  }

  // Log the detail, return none of it. An error body is not a place to leak
  // table names or query text to an unauthenticated caller.
  console.error('unhandled error [%s] %s %s', rid, c.req.method, c.req.path, error);

  return c.req.path.startsWith('/api/')
    ? c.json(err('Something went wrong.', ERROR.INTERNAL, rid), 500)
    : c.text('Something went wrong.', 500);
});

// ---------------------------------------------------------------------------
// Worker entry
// ---------------------------------------------------------------------------

export default {
  fetch: app.fetch,

  /**
   * 03:00 UTC — retention sweep (§3.4)
   * 04:00 UTC — canary staleness check (§7)
   */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    switch (event.cron) {
      case '0 3 * * *':
        ctx.waitUntil(runRetentionSweep(env).then(() => undefined));
        break;
      case '0 4 * * *':
        ctx.waitUntil(checkCanaryAge(env).then(() => undefined));
        break;
      default:
        console.warn('scheduled: no handler for cron %s', event.cron);
    }
  },

  async queue(batch: MessageBatch<PurgeMessage>, env: Env): Promise<void> {
    await handlePurge(batch, env);
  },
} satisfies ExportedHandler<Env, PurgeMessage>;
