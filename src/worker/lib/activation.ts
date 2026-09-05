/**
 * Whether a workspace ever actually arrived.
 *
 * A premortem on why groups sign up and then leave named the number worth
 * watching: not signups, but whether more than one person from the same
 * workspace showed up in the weeks after joining. A steward alone in an empty
 * workspace looks identical to a healthy one in every metric except this.
 *
 * Kept separate from the query that feeds it — scripts/activation-report.ts —
 * for the same reason src/shared/watch.ts keeps `matches()` out of the poller:
 * the rule for "did this count" is worth testing on its own, without a
 * database in the loop, and a change to the threshold should be a one-line
 * diff to a number this file owns rather than a rewritten SQL WHERE clause.
 *
 * ---------------------------------------------------------------------------
 * Why this is not `users.lastSeenOn`
 * ---------------------------------------------------------------------------
 *
 * `lastSeenOn` is overwritten forward on every login — it is, correctly, the
 * *most recent* date someone was seen. Using it to ask "did this person
 * arrive in their first two weeks" would misjudge in exactly the direction
 * that matters most: a workspace where everyone logs in constantly, forever,
 * would show a `lastSeenOn` of today for every member, indefinitely — making
 * the healthiest workspaces the ones that fail the check, since "today" is
 * never within two weeks of a months-old `createdAt`. `memberships.firstLoginOn`
 * is written once and never moves, which is the only shape this question can
 * be asked against.
 */

/** The two numbers a premortem asked for, named so a future change is a diff to one line. */
export const ACTIVATION_WINDOW_DAYS = 14;
export const ACTIVATION_THRESHOLD = 3;

export interface WorkspaceActivity {
  tenantId: string;
  tenantName: string;
  /** ISO timestamp. */
  createdAt: string;
  /**
   * One entry per membership row, `null` for a person who has never logged
   * in. Whoever is asking this question already knows who joined; this file
   * only judges when — or whether — they arrived.
   */
  firstLoginDates: Array<string | null>;
}

export interface ActivationVerdict {
  tenantId: string;
  tenantName: string;
  createdAt: string;
  /** How many distinct members arrived inside the window. */
  arrivedWithinWindow: number;
  activated: boolean;
}

/**
 * `null` rather than a verdict when the window has not closed yet.
 *
 * A workspace created nine days ago with one arrival is not failing — it has
 * five days left to. Judging it now would count every young, healthy
 * workspace as a miss, which is the report equivalent of a smoke test that
 * fails the code for not having read your emails from next week.
 */
export function computeActivation(
  workspace: WorkspaceActivity,
  now: Date = new Date(),
): ActivationVerdict | null {
  const created = new Date(workspace.createdAt);
  const windowEnd = new Date(created.getTime() + ACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (now < windowEnd) return null;

  const arrivedWithinWindow = workspace.firstLoginDates.filter(
    (d) => d !== null && new Date(d) <= windowEnd,
  ).length;

  return {
    tenantId: workspace.tenantId,
    tenantName: workspace.tenantName,
    createdAt: workspace.createdAt,
    arrivedWithinWindow,
    activated: arrivedWithinWindow >= ACTIVATION_THRESHOLD,
  };
}

export interface ActivationSummary {
  judged: number;
  tooNew: number;
  activated: number;
  notActivated: ActivationVerdict[];
}

/** The report's whole output: a count, and the list worth actually reading. */
export function summarizeActivation(
  workspaces: WorkspaceActivity[],
  now: Date = new Date(),
): ActivationSummary {
  const verdicts = workspaces.map((w) => computeActivation(w, now));
  const judged = verdicts.filter((v): v is ActivationVerdict => v !== null);

  return {
    judged: judged.length,
    tooNew: verdicts.length - judged.length,
    activated: judged.filter((v) => v.activated).length,
    // Oldest first: the ones that have been failing longest are the ones
    // worth reading about first.
    notActivated: judged
      .filter((v) => !v.activated)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  };
}
