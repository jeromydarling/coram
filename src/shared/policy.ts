/**
 * policy — what Coram will not help with, as data rather than prose.
 *
 * This file exists because "we don't support violent activism" is not a
 * policy, it is a press release. A policy has to say what conduct is
 * prohibited, in terms specific enough that a person can tell in advance
 * whether their organizing is welcome here.
 *
 * ---------------------------------------------------------------------------
 * The reason this is written the way it is
 * ---------------------------------------------------------------------------
 *
 * "Violent activism" is, in practice, the phrase used to describe tenant
 * unions, bail funds, and strike funds by people who would like them shut
 * down. A rule written in those words does not keep anyone safe; it hands a
 * lever to whoever files the most complaints.
 *
 * So the prohibitions below are about *conduct* — hurting people, arming
 * people, targeting individuals — and never about a cause, a tactic, or a
 * politics. Alongside them, PROTECTED names the things that are explicitly
 * fine here, including the ones that get people arrested. Civil disobedience
 * is unlawful by design and is not a violation of this policy. A blockade is
 * not violence. A picket line is not a threat.
 *
 * When a bad-faith report arrives claiming otherwise, this list is the answer
 * to it, and it is public for exactly that reason.
 *
 * ---------------------------------------------------------------------------
 * Where it is enforced
 * ---------------------------------------------------------------------------
 *
 * Two places, from this one source, so they cannot drift:
 *
 *   - the published acceptable use page, which renders these rules verbatim
 *   - `checkScope` (src/worker/lib/scope.ts), which refuses to draft this
 *     material before any model sees it
 *
 * The second matters more than it looks. Scriba runs on a general-purpose
 * model that has its own refusals, and it did refuse the first doxxing prompt
 * that reached it. That is luck, not a control: it is somebody else's safety
 * training, it is not ours to rely on, and it can change under us with a model
 * upgrade. The guard here is the part we own.
 */

export interface Rule {
  id: string;
  /** Stated as conduct, in the second person, short enough to quote. */
  text: string;
  /**
   * What `checkScope` matches. Deliberately narrow: every pattern here must
   * pass the PROTECTED list in policy.test.ts, which is what stops this
   * becoming a filter on militancy rather than on harm.
   */
  patterns: RegExp[];
}

/** A person, or a way of referring to one. Kept small on purpose. */
const PERSON = String.raw`(him|her|them|he|she|they|his|hers|theirs|the (landlord|cop|officer|boss|manager|senator|councilm[ae]n|judge|scab|owner)|[A-Z][a-z]+)`;

export const PROHIBITED: Rule[] = [
  {
    id: 'violence',
    text: 'Do not use Coram to plan, encourage, or coordinate physical harm to any person.',
    patterns: [
      // A violent verb with a person on the end of it. "Attack" alone is not
      // here — "an attack on our right to organize" is ordinary English.
      new RegExp(String.raw`\b(beat|jump|stab|shoot|assault|maim|hurt|injure|kill)\s+${PERSON}\b`, 'i'),
      /\b(beat|jump|shoot|stab)\s+(up|him|her|them)\b/i,
      /\b(hospitalis|hospitaliz)\w*\s+(him|her|them)\b/i,
      /\bmake\s+(him|her|them)\s+(bleed|hurt|pay for it with)\b/i,
    ],
  },
  {
    id: 'weapons',
    text: 'Do not use Coram to source, build, or distribute weapons or explosives.',
    patterns: [
      /\b(molotov|pipe bomb|pressure cooker bomb|ied\b|napalm|thermite)/i,
      /\b(build|make|assemble|construct)\s+(a|an|the)?\s*(bomb|explosive|detonator|silencer)\b/i,
      /\b(ghost gun|3d.?print(ed|ing)?\s+(a\s+)?(gun|firearm|receiver))/i,
      /\b(buy|get|source|bring)\s+(guns|firearms|ammunition|ammo)\s+(for|to)\s+(the|our|this)\b/i,
    ],
  },
  {
    id: 'targeting',
    text:
      'Do not use Coram to compile or publish private information about an individual — ' +
      'their home address, their movements, their family.',
    patterns: [
      /\b(home address|house address|where\s+(he|she|they)\s+lives?)\b/i,
      /\b(post|publish|share|dox|leak)\s+(his|her|their)\s+(address|home|phone number|licen[sc]e plate)\b/i,
      /\b(find out|look up|track down)\s+where\s+\w+\s+lives?\b/i,
      /\b(show up|turn up|go)\s+at\s+(his|her|their)\s+(house|home)\b/i,
      /\b(follow|tail|stake out)\s+(him|her|them)\s+(home|to (his|her|their) (house|home))\b/i,
      /\b(his|her|their)\s+(kids|children)['’]?s?\s+school\b/i,
    ],
  },
  {
    id: 'threats',
    text: 'Do not use Coram to threaten anyone, or to make anyone fear for their safety.',
    patterns: [
      new RegExp(String.raw`\bthreaten\s+${PERSON}\b`, 'i'),
      /\b(we|i)\s?('|’)?(ll|will)\s+(come for|get)\s+(him|her|them|you)\b/i,
      /\b(watch (his|her|their|your) back|sleep with one eye open|know where you live)\b/i,
      /\bscare\s+(him|her|them)\s+(off|out of)\b/i,
    ],
  },
  {
    id: 'exploitation',
    text: 'Do not use Coram in any way that sexualises a child or endangers one.',
    patterns: [/\b(child|minor|underage)\s+(porn|sexual|nude)/i, /\bcsam\b/i],
  },
  {
    id: 'trafficking',
    text: 'Do not use Coram to buy or sell people, or to coerce anyone into labour.',
    patterns: [/\b(traffick\w*)\s+(people|women|children|workers)\b/i],
  },
  {
    id: 'fraud',
    text:
      'Do not use Coram to raise money under false pretences, or to impersonate another ' +
      'group or person.',
    patterns: [
      /\b(fake|bogus|sham)\s+(donation|fundrais\w+|charity|invoice)\b/i,
      /\b(impersonate|pose as)\s+(a|an|the)\s+(police|officer|lawyer|official|organiz\w+)\b/i,
      /\b(launder|skim)\s+(the\s+)?(money|donations|funds)\b/i,
    ],
  },
];

/**
 * Organizing that is welcome here, stated so that no one has to guess.
 *
 * Everything in this list is protected *including when it is unlawful*. Civil
 * disobedience means accepting arrest; a policy that quietly excluded it would
 * exclude most of the history this product is built for.
 *
 * policy.test.ts asserts that no PROHIBITED pattern matches any of these. That
 * assertion is the real content of this list — it is a regression test against
 * our own future selves writing a broader rule.
 */
export const PROTECTED: string[] = [
  'Protest, marches, pickets, rallies, and demonstrations of any size.',
  'Strikes, walkouts, work stoppages, rent strikes, and boycotts.',
  'Civil disobedience, occupations, blockades, and sit-ins — including where these are ' +
    'unlawful and participants expect to be arrested.',
  'Bail funds, jail support, court support, and legal observing.',
  'Mutual aid, food distribution, eviction defence, and disaster response.',
  'Organizing that opposes a government, a company, a police department, or us.',
];

/**
 * Reported, reviewed by a person, and answered. No automated account deletion:
 * the cost of a wrong automated call here is a group losing its contacts in the
 * middle of a campaign, which is the harm this product exists to prevent.
 */
export const ENFORCEMENT: string[] = [
  'Reports go to a person, not a filter. We read them.',
  'We tell you what rule we think you broke and give you a chance to answer, unless someone ' +
    'is in immediate danger.',
  'We do not delete a workspace over a single disputed report.',
  'We publish the number of reports we receive and the number we act on (§7).',
];

export const ABUSE_CONTACT = 'abuse@coram.app';

/**
 * Which rule a piece of text breaks, or null.
 *
 * Returns the rule rather than a boolean so the caller can say which line was
 * crossed. A refusal that names the rule is answerable; "this violates our
 * policies" is not.
 */
export function violatedRule(text: string): Rule | null {
  for (const rule of PROHIBITED) {
    if (rule.patterns.some((p) => p.test(text))) return rule;
  }
  return null;
}
