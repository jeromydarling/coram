/**
 * ChannelDO — message delivery for Colloquium (§5.7).
 *
 * This object is where the only copy of a message's ciphertext lives, and it is
 * therefore the place §3.2 is either honoured or quietly broken.
 *
 * What it holds: sealed blobs the server cannot read, keyed by id, each with an
 * expiry taken from the channel's TTL. What it does not hold: plaintext, a
 * decryption key, a search index, a "recent messages" cache that outlives the
 * TTL, or any copy written elsewhere for convenience. Postgres gets an envelope
 * — channel, sender, rounded byte length, time — and nothing else.
 *
 * Why a Durable Object rather than a table: message ordering in a room has to
 * be consistent for everyone in it, which is a single-writer problem, and
 * because putting ciphertext in Postgres would mean it lived in backups,
 * replicas, and every snapshot the provider takes. A DO's storage is a smaller
 * and more honest surface for something we have promised to forget.
 *
 * Expiry is enforced on read as well as by the alarm. An alarm that failed to
 * fire must not be the difference between a message being gone and a message
 * being served, so a lapsed blob is never returned even if it is still on disk.
 */

interface SealedMessage {
  id: string;
  /** Client-side ciphertext. Opaque here, by design. */
  ciphertext: string;
  nonce: string;
  senderId: string;
  sentAt: number;
  expiresAt: number;
}

interface ChannelState {
  messages: SealedMessage[];
  ttlDays: number;
}

/**
 * A bound on how much a single channel keeps in memory. Beyond this the oldest
 * go early — a busy channel losing its oldest messages before their TTL is a
 * worse experience but a better privacy posture, and it is the direction to err.
 */
const MAX_RETAINED = 2_000;

export class ChannelDO implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/configure':
        return this.configure(await request.json());
      case '/send':
        return this.send(await request.json());
      case '/since':
        return this.since(await request.json());
      case '/purge':
        return this.purge();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async configure(body: { ttlDays: number }): Promise<Response> {
    const state = await this.read();
    // Capped at 30 here as well as in the CHECK constraint. A DO reached
    // directly must not be able to opt a channel out of §3.2.
    state.ttlDays = Math.min(Math.max(1, Math.floor(body.ttlDays)), 30);
    await this.write(state);
    return Response.json({ ttlDays: state.ttlDays });
  }

  private async send(body: {
    id: string;
    ciphertext: string;
    nonce: string;
    senderId: string;
  }): Promise<Response> {
    const state = await this.read();
    const now = Date.now();

    const message: SealedMessage = {
      id: body.id,
      ciphertext: body.ciphertext,
      nonce: body.nonce,
      senderId: body.senderId,
      sentAt: now,
      expiresAt: now + state.ttlDays * 86_400_000,
    };

    state.messages = this.live(state, now);
    state.messages.push(message);

    if (state.messages.length > MAX_RETAINED) {
      state.messages = state.messages.slice(-MAX_RETAINED);
    }

    await this.write(state);

    // One alarm at the next expiry. Cheaper than a periodic sweep and it means
    // an idle channel costs nothing to keep clean.
    const next = state.messages[0]?.expiresAt;
    if (next) await this.state.storage.setAlarm(next);

    return Response.json({ id: message.id, expiresAt: message.expiresAt });
  }

  /**
   * Everything still live since a cursor. Expiry filtered on read, so a missed
   * alarm cannot cause an expired message to be served.
   */
  private async since(body: { after?: number }): Promise<Response> {
    const state = await this.read();
    const now = Date.now();
    const after = body.after ?? 0;

    const messages = this.live(state, now).filter((m) => m.sentAt > after);

    return Response.json({
      messages,
      cursor: messages.at(-1)?.sentAt ?? after,
    });
  }

  /** Everyone leaves and the room is deleted. Removes the blobs immediately. */
  private async purge(): Promise<Response> {
    await this.state.storage.deleteAll();
    return Response.json({ ok: true });
  }

  /**
   * Fires at the next expiry.
   *
   * Rewrites the surviving set and re-arms. Note it writes even when nothing
   * expired: `live` is the only path that drops messages, and skipping the
   * write on a no-op would leave a channel whose alarm never re-arms.
   */
  async alarm(): Promise<void> {
    const state = await this.read();
    state.messages = this.live(state, Date.now());
    await this.write(state);

    const next = state.messages[0]?.expiresAt;
    if (next) await this.state.storage.setAlarm(next);
  }

  private live(state: ChannelState, now: number): SealedMessage[] {
    return state.messages.filter((m) => m.expiresAt > now);
  }

  private async read(): Promise<ChannelState> {
    return (
      (await this.state.storage.get<ChannelState>('channel')) ?? { messages: [], ttlDays: 30 }
    );
  }

  private async write(state: ChannelState): Promise<void> {
    await this.state.storage.put('channel', state);
  }
}
