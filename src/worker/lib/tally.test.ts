import { describe, expect, it } from 'vitest';

import {
  countedVotes,
  decide,
  EMPTY_TALLY,
  instantRunoff,
  quorumMet,
  toTally,
  turnout,
  type BallotRules,
  type Tally,
} from './tally';

const tally = (over: Partial<Tally> = {}): Tally => ({ ...EMPTY_TALLY, ...over });

const rules = (over: Partial<BallotRules> = {}): BallotRules => ({
  method: 'simple_majority',
  quorum: { numerator: 1, denominator: 2 },
  threshold: { numerator: 1, denominator: 2 },
  eligibleCount: 100,
  ...over,
});

describe('turnout and counted', () => {
  it('counts abstentions toward turnout', () => {
    // Abstaining is participation. A body where it did not count would push
    // people to vote no rather than abstain.
    expect(turnout(tally({ yes: 10, abstain: 5 }))).toBe(15);
  });

  it('excludes abstentions and stand-asides from the threshold', () => {
    // Standing aside means "I will not stop this", which is not a no.
    expect(countedVotes(tally({ yes: 10, no: 2, abstain: 5, stand_aside: 3, block: 1 }))).toBe(13);
  });
});

describe('quorum', () => {
  it('is exact integer arithmetic, not floating point', () => {
    // 1/3 of 100 is 33.33…; 33 must not round up into quorum.
    const third = rules({ quorum: { numerator: 1, denominator: 3 }, eligibleCount: 100 });
    expect(quorumMet(tally({ yes: 33 }), third)).toBe(false);
    expect(quorumMet(tally({ yes: 34 }), third)).toBe(true);
  });

  it('is met exactly at the boundary', () => {
    expect(quorumMet(tally({ yes: 50 }), rules())).toBe(true);
    expect(quorumMet(tally({ yes: 49 }), rules())).toBe(false);
  });

  it('is never met against an empty roll', () => {
    expect(quorumMet(tally({ yes: 5 }), rules({ eligibleCount: 0 }))).toBe(false);
  });

  it('is checked before the outcome, always', () => {
    // Unanimous but inquorate is not adopted. Reporting it as passed would
    // invite exactly the argument the rule exists to prevent.
    const result = decide(tally({ yes: 10 }), rules());
    expect(result.outcome).toBe('no_quorum');
    expect(result.reason).toMatch(/quorum/i);
  });
});

describe('consensus', () => {
  const consensus = rules({ method: 'consensus' });

  it('adopts when nobody objects', () => {
    const result = decide(tally({ yes: 60, stand_aside: 5 }), consensus);
    expect(result.outcome).toBe('adopted');
  });

  /*
   * The defining property. One block stops it, however lopsided the rest is —
   * softening this into "enough blocks" would be a different procedure wearing
   * consensus's name.
   */
  it('lets a single block stop a near-unanimous proposal', () => {
    const result = decide(tally({ yes: 98, block: 1, no: 0 }), consensus);
    expect(result.outcome).toBe('blocked');
    expect(result.reason).toMatch(/single block/i);
  });

  it('treats standing aside as not blocking', () => {
    expect(decide(tally({ yes: 51, stand_aside: 49 }), consensus).outcome).toBe('adopted');
  });

  it('rejects on plain opposition without a block', () => {
    expect(decide(tally({ yes: 60, no: 1 }), consensus).outcome).toBe('rejected');
  });
});

describe('modified consensus', () => {
  const modified = rules({
    method: 'modified_consensus',
    threshold: { numerator: 2, denominator: 3 },
  });

  it('overrides a block when the threshold is reached', () => {
    // 70 of 71 counted is over two thirds.
    const result = decide(tally({ yes: 70, block: 1 }), modified);
    expect(result.outcome).toBe('adopted');
    expect(result.reason).toMatch(/overridden/i);
  });

  it('lets the block stand when it is not', () => {
    // 40 yes of 70 counted is under two thirds.
    const result = decide(tally({ yes: 40, no: 20, block: 10 }), modified);
    expect(result.outcome).toBe('blocked');
    expect(result.reason).toMatch(/stood/i);
  });

  it('behaves like a threshold vote when nobody blocks', () => {
    expect(decide(tally({ yes: 70, no: 30 }), modified).outcome).toBe('adopted');
    expect(decide(tally({ yes: 60, no: 40 }), modified).outcome).toBe('rejected');
  });
});

describe('majority and supermajority', () => {
  it('carries a simple majority at exactly half', () => {
    expect(decide(tally({ yes: 50, no: 50 }), rules()).outcome).toBe('adopted');
    expect(decide(tally({ yes: 49, no: 51 }), rules()).outcome).toBe('rejected');
  });

  it('applies a two-thirds bar when the ballot carries one', () => {
    const two_thirds = rules({
      method: 'supermajority',
      threshold: { numerator: 2, denominator: 3 },
    });
    expect(decide(tally({ yes: 66, no: 33 }), two_thirds).outcome).toBe('adopted');
    expect(decide(tally({ yes: 66, no: 34 }), two_thirds).outcome).toBe('rejected');
  });

  it('ignores abstentions in the threshold but not in quorum', () => {
    // 60 people voted, so quorum (1/2 of 100) is met. Only 40 of those
    // expressed a preference, and 30 of 40 clears the half-way bar — the 20
    // abstentions helped reach quorum without counting against the motion.
    const result = decide(tally({ yes: 30, no: 10, abstain: 20 }), rules());
    expect(result.turnout).toBe(60);
    expect(result.quorumMet).toBe(true);
    expect(result.counted).toBe(40);
    expect(result.outcome).toBe('adopted');
  });

  it('rejects when quorum is made up entirely of abstentions', () => {
    const result = decide(tally({ abstain: 60 }), rules());
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toMatch(/no preference/i);
  });
});

describe('instantRunoff', () => {
  it('declares a first-round winner on an outright majority', () => {
    const result = instantRunoff([[0], [0], [0], [1], [2]], 3);
    expect(result.winner).toBe(0);
    expect(result.rounds).toHaveLength(1);
  });

  it('eliminates and redistributes', () => {
    // A:4 B:3 C:2. C is eliminated; both C ballots prefer B, so B wins 5–4.
    const ballots = [
      [0], [0], [0], [0],
      [1], [1], [1],
      [2, 1], [2, 1],
    ];
    const result = instantRunoff(ballots, 3);
    expect(result.winner).toBe(1);
    expect(result.rounds[0].eliminated).toBe(2);
  });

  /*
   * The choice that decides close elections: the majority is recomputed
   * against continuing ballots, not the original total. Counting exhausted
   * ballots in the denominator can leave a contest with no winner at all,
   * which is not a result a body can act on.
   */
  it('recomputes the majority against continuing ballots', () => {
    // A:2 B:2 C:1, and the C ballot ranks nothing else. After C goes, 4
    // ballots continue and 1 is exhausted.
    const result = instantRunoff([[0], [0], [1], [1], [2]], 3);
    expect(result.rounds[1]?.exhausted).toBe(1);
    // 2 of 4 is not a strict majority, so this is a genuine tie.
    expect(result.winner).toBeNull();
    expect(result.reason).toMatch(/tie/i);
  });

  it('refuses to break a tie itself', () => {
    const result = instantRunoff([[0], [1]], 2);
    expect(result.winner).toBeNull();
    expect(result.reason).toMatch(/tie-break applies/i);
  });

  it('is deterministic, so a recount agrees', () => {
    const ballots = [[0], [0], [1], [1], [2], [2]];
    const a = instantRunoff(ballots, 3);
    const b = instantRunoff(ballots, 3);
    expect(a).toEqual(b);
  });

  it('handles every ballot being exhausted', () => {
    const result = instantRunoff([[5], [6]], 2);
    expect(result.winner).toBeNull();
    expect(result.reason).toMatch(/exhausted/i);
  });

  it('handles an empty ballot paper', () => {
    expect(instantRunoff([], 0).winner).toBeNull();
  });

  it('terminates on a large field', () => {
    // Bounded by optionCount rounds; this would hang if elimination stalled.
    const ballots = Array.from({ length: 50 }, (_, i) => [i % 10]);
    const result = instantRunoff(ballots, 10);
    expect(result.rounds.length).toBeLessThanOrEqual(10);
  });
});

describe('decide', () => {
  it('refuses to decide a ranked ballot from a tally', () => {
    // A tally throws away the orderings, so answering here would be guessing.
    // Quorum has to be met first, or it returns no_quorum before reaching the
    // method at all — which is itself the right order.
    expect(() => decide(tally({ yes: 60 }), rules({ method: 'ranked_choice' }))).toThrow(
      /instantRunoff/,
    );
  });

  it('reports no_quorum on a ranked ballot before it would throw', () => {
    // Quorum is checked ahead of the method, so an inquorate ranked ballot
    // gets a real answer rather than an exception.
    expect(decide(tally({ yes: 10 }), rules({ method: 'ranked_choice' })).outcome).toBe(
      'no_quorum',
    );
  });
});

describe('toTally', () => {
  it('counts choices and skips nulls', () => {
    expect(toTally(['yes', 'yes', 'no', null, 'abstain'])).toEqual(
      tally({ yes: 2, no: 1, abstain: 1 }),
    );
  });
});
