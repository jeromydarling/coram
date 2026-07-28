/**
 * BallotDO — live tallies during an open vote (§5.8).
 *
 * A Durable Object because a tally is a single counter that many people watch
 * at once, and because reading Postgres on every poll from a hall full of
 * phones is the wrong shape. Increments are serialized here and the durable
 * record is still `votes` in Postgres — this is a cache with a lock, not the
 * source of truth. If it is ever lost, `refresh` rebuilds it from the rows.
 *
 * What it holds: five integers and a count of spent tokens. Not a voter id, not
 * a token, not a choice attributable to anyone. The unlinkability §5.8 asks for
 * would be pointless if the live tally quietly kept a list on the side, so this
 * object cannot become that even by accident — there is nowhere to put it.
 *
 * One deliberate restriction: for a secret ballot, the running tally is not
 * served while voting is open. See `snapshot`.
 */

import { decide, EMPTY_TALLY, type BallotRules, type Tally, type VoteChoice } from '../lib/tally';

interface BallotState {
  tally: Tally;
  /** How many tokens have been spent. Equals turnout; kept for a cheap check. */
  cast: number;
  rules: BallotRules | null;
  isSecret: boolean;
  closesAt: number | null;
}

const EMPTY: BallotState = {
  tally: { ...EMPTY_TALLY },
  cast: 0,
  rules: null,
  isSecret: true,
  closesAt: null,
};

export class BallotDO implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/configure':
        return this.configure(await request.json());
      case '/record':
        return this.record(await request.json());
      case '/snapshot':
        return this.snapshot();
      case '/refresh':
        return this.refresh(await request.json());
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async configure(body: {
    rules: BallotRules;
    isSecret: boolean;
    closesAt: string;
  }): Promise<Response> {
    const state = await this.read();
    state.rules = body.rules;
    state.isSecret = body.isSecret;
    state.closesAt = Date.parse(body.closesAt);
    await this.write(state);
    return Response.json({ ok: true });
  }

  /**
   * Count one vote.
   *
   * Takes a choice and nothing else — no token, no voter. Whether the vote was
   * legitimate was settled in Postgres by `cast_secret_vote` before this is
   * called; this object's job is arithmetic.
   */
  private async record(body: { choice: VoteChoice }): Promise<Response> {
    const state = await this.read();

    if (!(body.choice in state.tally)) {
      return Response.json({ error: 'unknown_choice' }, { status: 400 });
    }

    state.tally[body.choice] += 1;
    state.cast += 1;
    await this.write(state);

    return Response.json({ cast: state.cast });
  }

  /**
   * The live view.
   *
   * For a **secret** ballot while voting is open, this returns turnout only —
   * not the running split. A visible running tally in a secret ballot is a
   * quiet form of coercion: it tells the last people to vote exactly how much
   * their vote matters and which way the room is going, and in a small body it
   * can narrow who has not voted yet. Turnout is enough to know whether quorum
   * is in reach, which is the legitimate reason to look.
   *
   * A recorded ballot has no such problem, so it streams live.
   */
  private async snapshot(): Promise<Response> {
    const state = await this.read();
    const open = state.closesAt !== null && Date.now() < state.closesAt;

    if (state.isSecret && open) {
      return Response.json({
        open: true,
        secret: true,
        turnout: state.cast,
        eligible: state.rules?.eligibleCount ?? null,
        // Named so a client cannot mistake this for a tally it failed to parse.
        tallyWithheld: 'A secret ballot does not show a running count while voting is open.',
      });
    }

    return Response.json({
      open,
      secret: state.isSecret,
      turnout: state.cast,
      eligible: state.rules?.eligibleCount ?? null,
      tally: state.tally,
      result: state.rules ? decide(state.tally, state.rules) : null,
    });
  }

  /**
   * Rebuild from Postgres.
   *
   * Called after a restart, or whenever the two might have drifted. Postgres is
   * the record; this object is a convenience, and it should be treated as
   * disposable rather than repaired in place.
   */
  private async refresh(body: { tally: Tally; cast: number }): Promise<Response> {
    const state = await this.read();
    state.tally = { ...EMPTY_TALLY, ...body.tally };
    state.cast = body.cast;
    await this.write(state);
    return Response.json({ ok: true, cast: state.cast });
  }

  private async read(): Promise<BallotState> {
    const stored = await this.state.storage.get<BallotState>('ballot');
    return stored ?? structuredClone(EMPTY);
  }

  private async write(state: BallotState): Promise<void> {
    await this.state.storage.put('ballot', state);
  }
}
