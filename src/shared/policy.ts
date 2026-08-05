/**
 * Acceptable use — the conduct rules, as data.
 *
 * Written as a structured registry rather than a page of prose for the same
 * reason the retention rules are: a policy that exists only as copy drifts from
 * what the product actually does, and nobody notices. Tests in policy.test.ts
 * pin the invariants that make this policy honest rather than decorative.
 *
 * The shape of it, and why:
 *
 * **Conduct, never ideology.** Every prohibition below describes something a
 * person does. None describes what a person believes, which movement they
 * belong to, or how a government has classified them. "Violent extremism" is
 * the label most often applied to tenant unions, bail funds and strike funds —
 * the exact groups this product exists for — so a policy written around that
 * phrase would hand adversaries the lever it is supposed to deny them.
 *
 * **Protected activity is named, not implied.** §4 lists what we will not act
 * on even when reported, repeatedly, in bad faith. A prohibition list without a
 * protection list is an invitation to complain a movement off the platform.
 *
 * **The limits are published.** §3.2 encrypts channel content and §3.3 encrypts
 * organizer notes with a key we never hold. That is a deliberate choice and it
 * has a cost: we cannot see most of what happens here, so we cannot police it.
 * Saying so plainly is better than implying a vigilance we do not have.
 */

export interface Rule {
  id: string;
  title: string;
  /** The prohibition, in one sentence a person can act on. */
  rule: string;
  /** Why the line sits here. Shown on the page; not fine print. */
  why: string;
}

/**
 * The bright lines. All of these describe conduct directed at people.
 *
 * Deliberately short. A long list reads as thorough and behaves as arbitrary,
 * because every extra clause is another handle for someone arguing that a
 * rent strike belongs in it.
 */
export const PROHIBITED: Rule[] = [
  {
    id: 'violence',
    title: 'Organising violence against people',
    rule:
      'Do not use Coram to plan, coordinate, or recruit for acts intended to injure or kill ' +
      'people.',
    why:
      'This is the line, and it is about people rather than property or disruption. A ' +
      'blockade is not an injury. A picket is not an injury. Planning to hurt someone is.',
  },
  {
    id: 'targeting',
    title: 'Targeting a named person',
    rule:
      'Do not use Coram to build or distribute dossiers, home addresses, or movement patterns ' +
      'of a private individual in order to intimidate, stalk, or harass them.',
    why:
      'Coram is a database of people. That is precisely why it must not become an ' +
      'instrument for hunting one. This applies whoever the target is.',
  },
  {
    id: 'threats',
    title: 'Threats',
    rule: 'Do not use Coram to send threats of violence to anyone.',
    why: 'A threat is an act, not a view. It does not become organising because it is sent in bulk.',
  },
  {
    id: 'weapons',
    title: 'Arming for the above',
    rule:
      'Do not use Coram to acquire, distribute, or fundraise for weapons or explosives intended ' +
      'for use against people.',
    why:
      'Fundraising and logistics are the two things this product is best at. Both are in scope ' +
      'of the first rule.',
  },
  {
    id: 'exploitation',
    title: 'Exploitation of children',
    rule:
      'Do not use Coram to produce, store, or distribute sexual material involving children, or ' +
      'to arrange contact with a child for that purpose.',
    why: 'No context makes this organising. Reports here go straight to law enforcement.',
  },
  {
    id: 'trafficking',
    title: 'Trafficking people',
    rule: 'Do not use Coram to recruit, move, or hold people for forced labour or forced sex.',
    why: 'Same reason. The tooling here — lists, shifts, payments — is exactly what this abuse needs.',
  },
  {
    id: 'fraud',
    title: 'Taking money under false pretences',
    rule:
      'Do not use Coram to raise money for a cause, fund, or emergency that does not exist, or ' +
      'to divert money raised for one to something else.',
    why:
      'Mutual aid and bail funds run on the assumption that the money arrives where it was ' +
      'promised. A fraudulent fund does not just steal — it makes the next real one harder to ' +
      'raise.',
  },
];

/**
 * What we will not act on. This half is load-bearing.
 *
 * Every item here is something that has been reported to a platform as
 * "violence" or "extremism" in order to get an organisation removed. Naming
 * them means a report citing one is answered by pointing at this list rather
 * than by a judgement call under pressure.
 */
export const PROTECTED: Rule[] = [
  {
    id: 'protest',
    title: 'Protest, pickets, marches, rallies',
    rule: 'Organising people to gather in public and be loud about it is the point of this product.',
    why: 'We will not remove a group for holding a demonstration, however unpopular its cause.',
  },
  {
    id: 'strikes',
    title: 'Strikes and work stoppages',
    rule: 'Organising a strike, a walkout, or a slowdown is protected here.',
    why:
      'Employers routinely characterise strike organising as coercion or intimidation. A ' +
      'complaint from an employer about a strike is not evidence of anything.',
  },
  {
    id: 'civil-disobedience',
    title: 'Non-violent civil disobedience',
    rule:
      'Sit-ins, occupations, blockades, lock-ons, and trespass are protected here, including ' +
      'where they are unlawful.',
    why:
      'Civil disobedience is illegal by design and non-violent by definition. Treating "illegal" ' +
      'and "violent" as the same word would remove most of the tradition this product is built ' +
      'for. If the state prosecutes, that is between the state and the organiser; it is not our ' +
      'role to help by removing their tools first.',
  },
  {
    id: 'bail-and-jail-support',
    title: 'Bail funds, jail support, legal observing',
    rule: 'Raising bail, tracking arrests, and supporting people through custody are protected here.',
    why:
      'These are the most frequently reported and the most obviously legitimate. Coram takes no ' +
      'fee from them precisely because they matter most.',
  },
  {
    id: 'mutual-aid',
    title: 'Mutual aid',
    rule: 'Distributing food, money, supplies, or shelter to people who need them is protected here.',
    why: 'Including when it is done without a permit, and including when it embarrasses somebody.',
  },
  {
    id: 'designations',
    title: 'Being called an extremist',
    rule:
      'A government, employer, or campaign group labelling an organisation extremist is not, on ' +
      'its own, grounds for any action here.',
    why:
      'Designations follow politics. If a designation were sufficient, this policy would simply ' +
      'be a list maintained by whoever is currently in office.',
  },
];

/**
 * What we can actually see, stated plainly rather than implied.
 *
 * Rewritten out of the vocabulary it was in. It said "Colloquium encrypts
 * them" and "we hold only ciphertext" — a module name and a term of art, on a
 * page read by someone deciding whether their group is safe here. The facts
 * are unchanged; the words are ones they already have.
 */
export const LIMITS: string[] = [
  'We do not read your channel messages. They are encrypted before they leave your device, and ' +
    'nothing that would open them ever reaches us.',
  'We do not read your organiser notes. Those are encrypted on your own screen, with a ' +
    'passphrase we never see.',
  'We cannot check what is inside them for prohibited material, because most of what we hold is ' +
    'unreadable to us. That is the trade, and it is the right way round.',
  'So enforcement here runs on reports, and on what is already out in the open — petitions, ' +
    'public event pages, fundraising pages. It is not, and cannot be, proactive surveillance.',
];

/** How a report is handled. Published so the process can be held to. */
export const ENFORCEMENT: string[] = [
  'A report must name the workspace and describe specific conduct. "This group is dangerous" is ' +
    'not a report and gets no action.',
  'We act on evidence we can verify ourselves, not on the number of complaints received. ' +
    'Coordinated reporting campaigns are common and are not evidence.',
  'Except where there is a credible risk of imminent harm, the workspace is told what was ' +
    'alleged and has seven days to respond before any action.',
  'Suspension and termination require two people, one of whom holds the legal role. No single ' +
    'person can remove an organisation.',
  'Any action can be appealed to a person who was not involved in the original decision.',
  'Counts — reports received, actions taken, reports rejected — are published in the ' +
    'transparency report at /trust. Not the names.',
];

/**
 * The one place a report can be made.
 *
 * Deliberately an address rather than a form: a form implies a queue and a
 * team, and until those exist saying so would be a claim we cannot back.
 */
export const ABUSE_CONTACT = 'abuse@coram.app';

// ---------------------------------------------------------------------------
// Enforcement in the product, not only on the page
// ---------------------------------------------------------------------------

/**
 * Patterns that let `checkScope` refuse to draft prohibited material before any
 * model sees the request (src/worker/lib/scope.ts).
 *
 * This exists because of something the first live Scriba deploy showed. A
 * request to find a landlord's home address and post it was refused — by Llama,
 * not by us. That is somebody else's safety training. It is not tested here, it
 * is not ours, and it changes with a model upgrade. LIMITS above is honest that
 * we cannot scan content we hold as ciphertext; this is the narrow case where
 * we are not a bystander, because the request is being made *to us*.
 *
 * Kept beside the rules rather than in the guard so a rule and its enforcement
 * are read together, and keyed by id so a new prohibition cannot be added
 * without a test noticing it has no patterns.
 *
 * Deliberately narrow. Every pattern must leave the whole of PROTECTED
 * untouched — policy.test.ts asserts that against real organising requests,
 * which is what stops this drifting into a filter on militancy. A missed
 * violation is a request a model then handles on its own; an over-broad one is
 * a rent strike this product refused to help with, and that is the worse
 * failure.
 */
const PERSON = String.raw`(him|her|them|he|she|they|his|hers|theirs|the (landlord|cop|officer|boss|manager|senator|councilm[ae]n|judge|scab|owner)|[A-Z][a-z]+)`;

const PATTERNS: Record<string, RegExp[]> = {
  violence: [
    // A violent verb with a person on the end of it. "Attack" alone is absent:
    // "an attack on our right to organise" is ordinary English.
    new RegExp(String.raw`\b(beat|jump|stab|shoot|assault|maim|hurt|injure|kill)\s+${PERSON}\b`, 'i'),
    /\b(beat|jump|shoot|stab)\s+(up|him|her|them)\b/i,
    /\b(hospitalis|hospitaliz)\w*\s+(him|her|them)\b/i,
    /\bmake\s+(him|her|them)\s+(bleed|hurt)\b/i,
  ],
  targeting: [
    /\b(home address|house address|where\s+(he|she|they)\s+lives?)\b/i,
    /\b(post|publish|share|dox|leak)\s+(his|her|their)\s+(address|home|phone number|licen[sc]e plate)\b/i,
    /\b(find out|look up|track down)\s+where\s+\w+\s+lives?\b/i,
    /\b(show up|turn up|go)\s+at\s+(his|her|their)\s+(house|home)\b/i,
    /\b(follow|tail|stake out)\s+(him|her|them)\s+(home|to (his|her|their) (house|home))\b/i,
    /\b(his|her|their)\s+(kids|children)['’]?s?\s+school\b/i,
  ],
  threats: [
    new RegExp(String.raw`\bthreaten\s+${PERSON}\b`, 'i'),
    /\b(we|i)\s?('|’)?(ll|will)\s+(come for|get)\s+(him|her|them|you)\b/i,
    /\b(watch (his|her|their|your) back|sleep with one eye open|know where you live)\b/i,
    /\bscare\s+(him|her|them)\s+(off|out of)\b/i,
  ],
  weapons: [
    /\b(molotov|pipe bomb|pressure cooker bomb|ied\b|napalm|thermite)/i,
    /\b(build|make|assemble|construct)\s+(a|an|the)?\s*(bomb|explosive|detonator|silencer)\b/i,
    /\b(ghost gun|3d.?print(ed|ing)?\s+(a\s+)?(gun|firearm|receiver))/i,
    /\b(buy|get|source|bring)\s+(guns|firearms|ammunition|ammo)\s+(for|to)\s+(the|our|this)\b/i,
  ],
  exploitation: [/\b(child|minor|underage)\s+(porn|sexual|nude)/i, /\bcsam\b/i],
  trafficking: [/\b(traffick\w*)\s+(people|women|children|workers)\b/i],
  fraud: [
    /\b(fake|bogus|sham)\s+(donation|fundrais\w+|charity|invoice)\b/i,
    /\b(impersonate|pose as)\s+(a|an|the)\s+(police|officer|lawyer|official|organiz\w+)\b/i,
    /\b(launder|skim)\s+(the\s+)?(money|donations|funds)\b/i,
  ],
};

/**
 * Which rule a request breaks, or null.
 *
 * Returns the rule rather than a boolean so a refusal can name the line that
 * was crossed. "This violates our policies" is a wall; a refusal you can argue
 * with is one that can be found wrong and corrected.
 */
export function violatedRule(text: string): Rule | null {
  for (const rule of PROHIBITED) {
    if (PATTERNS[rule.id]?.some((p) => p.test(text))) return rule;
  }
  return null;
}

/** For the test that asserts no prohibition is left unenforced. */
export const ENFORCED_IDS = Object.keys(PATTERNS);

/** Words that describe belief rather than conduct. None may appear in a rule. */
export const IDEOLOGY_WORDS = [
  'extremist',
  'extremism',
  'radical',
  'radicalisation',
  'radicalization',
  'ideology',
  'anti-government',
  'subversive',
  'un-american',
];
