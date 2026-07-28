/**
 * tally — counting votes (§5.8).
 *
 * Pure functions over counts. No database, no clock, no randomness: a tally is
 * the one thing in this product that a member may want to recompute by hand
 * from the published numbers, and that only works if the same inputs always
 * give the same answer.
 *
 * The five methods are not variations on majority rule. Consensus is a
 * different decision procedure with a different failure mode, and collapsing it
 * into "majority with extra steps" is how governance software ends up unusable
 * by the groups that most need it.
 */

export type VotingMethod =
  | 'consensus'
  | 'modified_consensus'
  | 'simple_majority'
  | 'supermajority'
  | 'ranked_choice';

export type VoteChoice = 'yes' | 'no' | 'abstain' | 'block' | 'stand_aside';

export interface Fraction {
  numerator: number;
  denominator: number;
}

export interface BallotRules {
  method: VotingMethod;
  /** Fraction of the eligible roll that must participate. */
  quorum: Fraction;
  /** Fraction of counted votes needed to carry. */
  threshold: Fraction;
  /** Size of the roll, frozen when the ballot opened. */
  eligibleCount: number;
}

export type Tally = Record<VoteChoice, number>;

export type Outcome = 'adopted' | 'rejected' | 'no_quorum' | 'blocked';

export interface Result {
  outcome: Outcome;
  turnout: number;
  quorumMet: boolean;
  /** Votes that counted toward the threshold. Excludes abstentions. */
  counted: number;
  /** Plain-language account of why, for the minutes. */
  reason: string;
}

export const EMPTY_TALLY: Tally = Object.freeze({
  yes: 0,
  no: 0,
  abstain: 0,
  block: 0,
  stand_aside: 0,
});

/**
 * Everyone who cast anything, including abstentions.
 *
 * Abstaining is participation — turning up and declining to take a side is how
 * a member signals presence without preference, and it counts toward quorum. A
 * body where abstentions did not count would push people to vote no rather than
 * abstain, which is a different thing entirely.
 */
export function turnout(tally: Tally): number {
  return tally.yes + tally.no + tally.abstain + tally.block + tally.stand_aside;
}

/**
 * Votes that bear on the threshold.
 *
 * Abstentions and stand-asides drop out. Standing aside in a consensus process
 * means "I do not support this but I will not stop it", which is explicitly not
 * a no — counting it as one would make the safety valve act like opposition and
 * teach people to block instead.
 */
export function countedVotes(tally: Tally): number {
  return tally.yes + tally.no + tally.block;
}

function meets(part: number, whole: number, fraction: Fraction): boolean {
  if (whole <= 0) return false;
  // Cross-multiplied so this is exact integer arithmetic. part/whole >= n/d
  // becomes part*d >= n*whole, with no floating point anywhere near a vote.
  return part * fraction.denominator >= fraction.numerator * whole;
}

export function quorumMet(tally: Tally, rules: BallotRules): boolean {
  return meets(turnout(tally), rules.eligibleCount, rules.quorum);
}

/**
 * Decide a ballot.
 *
 * Quorum first, always. A proposal that passes without quorum has not passed,
 * and reporting it as adopted-but-inquorate would invite exactly the argument
 * the rule exists to prevent.
 */
export function decide(tally: Tally, rules: BallotRules): Result {
  const participation = turnout(tally);
  const counted = countedVotes(tally);
  const quorum = quorumMet(tally, rules);

  const base: Omit<Result, 'outcome' | 'reason'> = {
    turnout: participation,
    quorumMet: quorum,
    counted,
  };

  if (!quorum) {
    return {
      ...base,
      outcome: 'no_quorum',
      reason:
        `${participation} of ${rules.eligibleCount} eligible members voted; ` +
        `quorum is ${rules.quorum.numerator}/${rules.quorum.denominator}.`,
    };
  }

  switch (rules.method) {
    case 'consensus': {
      // One block stops it. That is what consensus means, and softening it into
      // "enough blocks" would be a different procedure wearing its name.
      if (tally.block > 0) {
        return {
          ...base,
          outcome: 'blocked',
          reason: `${tally.block} member(s) blocked. Under consensus, a single block prevents adoption.`,
        };
      }
      if (tally.no > 0) {
        return {
          ...base,
          outcome: 'rejected',
          reason: `${tally.no} member(s) opposed without blocking. Consensus was not reached.`,
        };
      }
      return {
        ...base,
        outcome: 'adopted',
        reason:
          `Consensus: ${tally.yes} in favour, no objections` +
          (tally.stand_aside ? `, ${tally.stand_aside} standing aside.` : '.'),
      };
    }

    case 'modified_consensus': {
      // Blocks still count, but the body can override them at the threshold.
      // This is the method groups adopt after one person has held everything up
      // once too often.
      if (tally.block > 0) {
        const overridden = meets(tally.yes, counted, rules.threshold);
        return overridden
          ? {
              ...base,
              outcome: 'adopted',
              reason:
                `${tally.block} block(s) overridden by ${tally.yes} of ${counted} votes, ` +
                `meeting the ${rules.threshold.numerator}/${rules.threshold.denominator} threshold.`,
            }
          : {
              ...base,
              outcome: 'blocked',
              reason:
                `${tally.block} block(s) stood: ${tally.yes} of ${counted} votes did not reach ` +
                `the ${rules.threshold.numerator}/${rules.threshold.denominator} needed to override.`,
            };
      }
      return decideByThreshold(tally, rules, base);
    }

    case 'simple_majority':
    case 'supermajority':
      // Same arithmetic; the difference is the threshold the ballot carries,
      // which is why there is one code path and not two.
      return decideByThreshold(tally, rules, base);

    case 'ranked_choice':
      // Handled by instantRunoff, which needs the full rankings rather than a
      // tally. Reaching here means a ballot was decided with the wrong call.
      throw new Error('Ranked choice ballots are decided with instantRunoff, not decide.');
  }
}

function decideByThreshold(
  tally: Tally,
  rules: BallotRules,
  base: Omit<Result, 'outcome' | 'reason'>,
): Result {
  if (base.counted === 0) {
    // Quorum was met entirely by abstentions. Nobody expressed a preference, so
    // nothing was decided — reporting this as rejection would misdescribe it.
    return {
      ...base,
      outcome: 'rejected',
      reason: 'Everyone who voted abstained or stood aside. No preference was expressed.',
    };
  }

  const carried = meets(tally.yes, base.counted, rules.threshold);
  return {
    ...base,
    outcome: carried ? 'adopted' : 'rejected',
    reason:
      `${tally.yes} in favour and ${tally.no + tally.block} against of ${base.counted} counted; ` +
      `${rules.threshold.numerator}/${rules.threshold.denominator} was ` +
      `${carried ? 'met' : 'not met'}.`,
  };
}

// ---------------------------------------------------------------------------
// Ranked choice
// ---------------------------------------------------------------------------

export interface RunoffRound {
  counts: Record<number, number>;
  eliminated: number | null;
  exhausted: number;
}

export interface RunoffResult {
  winner: number | null;
  rounds: RunoffRound[];
  reason: string;
}

/**
 * Instant-runoff.
 *
 * Each ballot is an ordered list of option indices, most preferred first. A
 * voter need not rank everything; a ballot whose remaining preferences are all
 * eliminated is exhausted and stops counting.
 *
 * The majority is recomputed each round against *continuing* ballots rather
 * than the original total. That is the choice that decides close elections:
 * counting exhausted ballots in the denominator can leave a contest with no
 * winner at all, which is not a result a body can act on.
 */
export function instantRunoff(ballots: number[][], optionCount: number): RunoffResult {
  const rounds: RunoffRound[] = [];
  const eliminated = new Set<number>();

  if (optionCount === 0) return { winner: null, rounds, reason: 'No options on the ballot.' };

  // Bounded: each round eliminates one option, so at most optionCount rounds.
  for (let round = 0; round < optionCount; round++) {
    const counts: Record<number, number> = {};
    for (let i = 0; i < optionCount; i++) if (!eliminated.has(i)) counts[i] = 0;

    let continuing = 0;
    let exhausted = 0;

    for (const ballot of ballots) {
      const choice = ballot.find((option) => !eliminated.has(option) && option < optionCount);
      if (choice === undefined) {
        exhausted++;
        continue;
      }
      counts[choice] = (counts[choice] ?? 0) + 1;
      continuing++;
    }

    const remaining = Object.keys(counts).map(Number);

    if (continuing === 0) {
      rounds.push({ counts, eliminated: null, exhausted });
      return { winner: null, rounds, reason: 'Every ballot was exhausted before a winner emerged.' };
    }

    const leader = remaining.reduce((best, o) => (counts[o] > counts[best] ? o : best), remaining[0]);

    // Strict majority of continuing ballots.
    if (counts[leader] * 2 > continuing) {
      rounds.push({ counts, eliminated: null, exhausted });
      return {
        winner: leader,
        rounds,
        reason:
          `Option ${leader} reached ${counts[leader]} of ${continuing} continuing ballots ` +
          `in round ${round + 1}.`,
      };
    }

    if (remaining.length <= 2) {
      // Two left and neither has a majority: an exact tie. Deliberately not
      // broken here. A coin toss belongs to the body's own rules, and a piece
      // of software silently picking a winner in a tied election is the last
      // thing anyone needs.
      rounds.push({ counts, eliminated: null, exhausted });
      return {
        winner: null,
        rounds,
        reason: `Tied at ${counts[remaining[0]]} each. The body's own tie-break applies.`,
      };
    }

    // Eliminate the lowest. On a tie for last, the lower index goes — arbitrary
    // but deterministic, so a recount reaches the same answer.
    const loser = remaining.reduce((worst, o) => (counts[o] < counts[worst] ? o : worst), remaining[0]);
    eliminated.add(loser);
    rounds.push({ counts, eliminated: loser, exhausted });
  }

  return { winner: null, rounds, reason: 'No option achieved a majority.' };
}

/** Turn vote rows into a tally. */
export function toTally(choices: Array<VoteChoice | null>): Tally {
  const tally: Tally = { ...EMPTY_TALLY };
  for (const choice of choices) if (choice) tally[choice] += 1;
  return tally;
}
