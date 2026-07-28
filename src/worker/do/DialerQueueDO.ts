/**
 * DialerQueueDO — the phone bank queue (§5.4).
 *
 * One instance per dialing session. A Durable Object is the right shape here
 * for a specific reason: handing the same person to two volunteers at once is
 * the failure that makes a phone bank unusable, and a DO is single-threaded,
 * so "take the next number" cannot interleave. Doing this in Postgres would
 * mean SELECT ... FOR UPDATE SKIP LOCKED and a round trip per call; doing it in
 * KV would race.
 *
 * What it holds: contact ids and a claim state. No names, no numbers, no notes.
 * The volunteer's client fetches the contact through the normal RLS-scoped API,
 * so turf bounds still apply and nothing personal is duplicated into DO storage
 * where the burn switch would have to chase it.
 *
 * Per-sender throttling (§5.4) lives here too, because the queue is the only
 * place that sees every caller in a session at once.
 */

/** How long a claimed number is held before it returns to the queue. */
const CLAIM_TTL_MS = 5 * 60 * 1000;

/** §5.4 per-sender throttling. A person, not a robot. */
const MIN_MS_BETWEEN_CALLS = 5_000;

interface Claim {
  contactId: string;
  callerId: string;
  claimedAt: number;
}

interface QueueState {
  /** Not yet handed out, in order. */
  pending: string[];
  /** Handed out and not yet reported on, keyed by contact id. */
  claimed: Record<string, Claim>;
  /** Reported on. Kept as a count only. */
  completed: number;
  /** Last hand-out per caller, for throttling. */
  lastServedAt: Record<string, number>;
}

const EMPTY: QueueState = { pending: [], claimed: {}, completed: 0, lastServedAt: {} };

export class DialerQueueDO implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/load':
        return this.load(await request.json());
      case '/next':
        return this.next(await request.json());
      case '/release':
        return this.release(await request.json());
      case '/complete':
        return this.complete(await request.json());
      case '/status':
        return this.status();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Seed the queue. Idempotent per contact so re-loading a session after a
   * disconnect does not queue everyone twice.
   */
  private async load(body: { contactIds: string[] }): Promise<Response> {
    const queue = await this.read();

    const known = new Set([...queue.pending, ...Object.keys(queue.claimed)]);
    for (const id of body.contactIds) {
      if (!known.has(id)) queue.pending.push(id);
    }

    await this.write(queue);
    return Response.json({ pending: queue.pending.length });
  }

  /** Hand the next number to a caller. */
  private async next(body: { callerId: string }): Promise<Response> {
    const queue = await this.read();
    const now = Date.now();

    this.reclaimExpired(queue, now);

    // Throttle. A caller asking again immediately is either a stuck client or
    // someone hammering through without speaking to anyone; both want slowing.
    const last = queue.lastServedAt[body.callerId] ?? 0;
    const wait = MIN_MS_BETWEEN_CALLS - (now - last);
    if (wait > 0) {
      await this.write(queue);
      return Response.json({ status: 'throttled', retryInMs: wait }, { status: 429 });
    }

    const contactId = queue.pending.shift();
    if (!contactId) {
      await this.write(queue);
      return Response.json({
        status: 'empty',
        outstanding: Object.keys(queue.claimed).length,
      });
    }

    queue.claimed[contactId] = { contactId, callerId: body.callerId, claimedAt: now };
    queue.lastServedAt[body.callerId] = now;
    await this.write(queue);

    return Response.json({ status: 'assigned', contactId, remaining: queue.pending.length });
  }

  /** Give a number back unreported — a caller closing their laptop mid-shift. */
  private async release(body: { contactId: string }): Promise<Response> {
    const queue = await this.read();

    if (queue.claimed[body.contactId]) {
      delete queue.claimed[body.contactId];
      // Back to the front: this number has already waited once.
      queue.pending.unshift(body.contactId);
      await this.write(queue);
    }

    return Response.json({ pending: queue.pending.length });
  }

  /**
   * The call happened and an outcome was recorded.
   *
   * The outcome itself goes to Postgres through the API, where the opt-out
   * trigger and RLS apply. This only stops the number coming round again.
   */
  private async complete(body: { contactId: string }): Promise<Response> {
    const queue = await this.read();

    if (queue.claimed[body.contactId]) {
      delete queue.claimed[body.contactId];
      queue.completed += 1;
      await this.write(queue);
    }

    return Response.json({ completed: queue.completed, pending: queue.pending.length });
  }

  private async status(): Promise<Response> {
    const queue = await this.read();
    this.reclaimExpired(queue, Date.now());
    await this.write(queue);

    return Response.json({
      pending: queue.pending.length,
      inFlight: Object.keys(queue.claimed).length,
      completed: queue.completed,
    });
  }

  /**
   * Return abandoned claims to the queue.
   *
   * Without this, a volunteer who closes their browser mid-call takes that
   * person out of the phone bank for the rest of the session — and on a list
   * being worked by a dozen people, that silently loses a slice of the turf.
   */
  private reclaimExpired(queue: QueueState, now: number): void {
    for (const [contactId, claim] of Object.entries(queue.claimed)) {
      if (now - claim.claimedAt > CLAIM_TTL_MS) {
        delete queue.claimed[contactId];
        queue.pending.unshift(contactId);
      }
    }
  }

  private async read(): Promise<QueueState> {
    return (await this.state.storage.get<QueueState>('queue')) ?? structuredClone(EMPTY);
  }

  private async write(queue: QueueState): Promise<void> {
    await this.state.storage.put('queue', queue);
  }
}
