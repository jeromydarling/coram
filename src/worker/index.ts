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

import type { Env, PurgeMessage, SendMessage, Vars } from './env';
import { attachSession } from './lib/auth';
import { ERROR, err, requestId } from './lib/http';
import { TenancyError } from './lib/rls';
import { checkCanaryAge } from './cron/canary';
import { runRetentionSweep } from './cron/purge';
import { handlePurge } from './jobs/purge';
import { handleSend } from './jobs/send';
import { auth } from './routes/api/auth';
import { campaigns } from './routes/api/campaigns';
import { consilium } from './routes/api/consilium';
import { contacts } from './routes/api/contacts';
import { custos } from './routes/api/custos';
import { exports } from './routes/api/exports';
import { federatio } from './routes/api/federatio';
import { funds } from './routes/api/funds';
import { scriba } from './routes/api/scriba';
import { vinculum } from './routes/api/vinculum';
import { events } from './routes/api/events';
import { imports } from './routes/api/imports';
import { marketing } from './routes/marketing';
import { publicEvents } from './routes/public-events';
import { publicUnsubscribe } from './routes/public-unsubscribe';
import { stripeWebhook } from './routes/webhooks/stripe';
import { workspace } from './routes/api/workspace';

/** Durable Object classes must be exported from the Worker entry. */
export { BallotDO } from './do/BallotDO';
export { ChannelDO } from './do/ChannelDO';
export { DialerQueueDO } from './do/DialerQueueDO';

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
app.route('/api/contacts', contacts);
app.route('/api/imports', imports);
app.route('/api/exports', exports);
app.route('/api/events', events);
app.route('/api/campaigns', campaigns);
app.route('/api/funds', funds);
app.route('/api/vinculum', vinculum);
app.route('/api/consilium', consilium);
app.route('/api/custos', custos);
app.route('/api/scriba', scriba);
app.route('/api/federatio', federatio);

// Signature-verified, no session (§1.1). Mounted before the SPA and marketing
// so nothing else can shadow it.
app.route('/webhooks', stripeWebhook);

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

// Public event pages (§5.3). No session; they reach Postgres through the
// SECURITY DEFINER functions in 0003, so RLS is not bypassed, just not
// applicable to a caller who has no tenant.
app.route('/', publicEvents);
app.route('/', publicUnsubscribe);

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

  /**
   * Two queues, one consumer entry point. Dispatch on the queue name rather
   * than sniffing the message shape, so a message arriving on the wrong queue
   * is a visible error instead of quietly doing the wrong work.
   */
  async queue(batch: MessageBatch<PurgeMessage | SendMessage>, env: Env): Promise<void> {
    switch (batch.queue) {
      case 'coram-purge':
        await handlePurge(batch as MessageBatch<PurgeMessage>, env);
        break;
      case 'coram-send':
        await handleSend(batch as MessageBatch<SendMessage>, env);
        break;
      default:
        console.error('queue: no consumer for %s', batch.queue);
    }
  },
} satisfies ExportedHandler<Env, PurgeMessage | SendMessage>;
