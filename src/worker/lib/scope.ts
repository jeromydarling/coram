/**
 * scope — what Scriba will and will not answer (§5.10).
 *
 * Ported from CROS `src/lib/nri/scopeGuardrails.ts` at commit 1ff1e33. The
 * pattern sets are theirs and were good; the responses are rewritten, because
 * CROS's were addressed to parish staff and §2's copy rules are different —
 * short declarative sentences, no exclamation points, name the thing plainly.
 *
 * Coram needs this more than CROS did. Custos (§5.9) puts this product in front
 * of people during arrests and jail support, and an organizing tool that
 * answers "I can't cope" with a chatbot paragraph is a genuine harm rather than
 * an off-topic response.
 *
 * Runs before redaction and before any dispatch. A message that fails here
 * never reaches a model at all, which is also why the crisis branch is checked
 * first: it is the one case where the right answer is a phone number and not a
 * completion.
 */

export type ScopeRefusal =
  | 'crisis'
  | 'emotional_support'
  | 'professional_advice'
  | 'off_topic'
  | 'prompt_injection';

export interface ScopeResult {
  allowed: boolean;
  reason?: ScopeRefusal;
  /** Shown to the user instead of a model response. */
  response?: string;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const CRISIS = [
  /\b(suicid|kill myself|end my life|want to die|don'?t want to live)\b/i,
  /\b(self.?harm|cutting myself|hurt myself)\b/i,
  /\b(abuse|abused|abusing|domestic violence|sexual assault)\b/i,
  /\b(eating disorder|anorexia|bulimia)\b/i,
  /\b(addiction|addicted|substance abuse|drug problem|alcoholi[sc])\b/i,
  /\b(panic attack|anxiety attack|mental breakdown)\b/i,
  /\b(depressed|depression|feel hopeless|feel worthless)\b/i,
];

const EMOTIONAL_SUPPORT = [
  /\b(i feel (so )?(sad|lonely|anxious|scared|depressed|overwhelmed|broken|empty|lost))\b/i,
  /\b(i need (someone to talk to|emotional support|therapy|counseling|help with my feelings))\b/i,
  /\b(can you (be my|act as a) (therapist|counselor|psychologist))\b/i,
  /\b(my (marriage|relationship|divorce|breakup|spouse|partner))\b/i,
  /\b(i'?m (going through|dealing with|struggling with) (a lot|something|grief|loss))\b/i,
  /\b(listen to me vent|need to vent|just need to talk)\b/i,
];

const PROFESSIONAL_ADVICE = [
  /\b(diagnos|symptom|medication|prescri|medical advice)\b/i,
  /\b(legal advice|sue |lawsuit|attorney|lawyer)\b/i,
  /\b(tax advice|tax return|file my taxes)\b/i,
  /\b(invest|stock|crypto|trading advice)\b/i,
];

const OFF_TOPIC = [
  /\b(write me (a |an )?(poem|song|story|essay|joke|haiku|limerick))\b/i,
  /\b(tell me (a |about )?(joke|riddle|fun fact|story about))\b/i,
  /\b(what is the (meaning of life|capital of|population of|weather|stock price))\b/i,
  /\b(explain (quantum|relativity|blockchain|cryptocurrency|bitcoin))\b/i,
  /\b(help me with (my homework|an essay|a paper|code|coding|programming))\b/i,
  /\b(write (code|python|javascript|html|css|sql|a program))\b/i,
  /\b(translate .{3,} (to|into) (spanish|french|german|chinese|japanese))\b/i,
  /\b(recipe for|how to cook|how to bake)\b/i,
  /\b(play (a game|20 questions|trivia|would you rather))\b/i,
  /\b(roleplay|pretend (you are|to be))\b/i,
  /\b(are you (sentient|conscious|alive|real|human))\b/i,
];

const INJECTION = [
  /ignore .{0,20}(instructions|rules|prompt|system)/i,
  /\b(jailbreak|dan mode|developer mode)\b/i,
  /\bbypass\b/i,
  /\b(system prompt|your instructions|previous instructions)\b/i,
];

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/*
 * The numbers are US-only, which is a real limitation for a product that will
 * be used elsewhere. Better a wrong-country number than none while the
 * per-region list is outstanding — but this is worth fixing before Coram is
 * used outside the US, and it is not a detail to discover in production.
 */
const CRISIS_RESPONSE = `This sounds like something I am not able to help with, and I do not want to pretend otherwise.

If you need to talk to someone now:

- 988 Suicide & Crisis Lifeline — call or text 988
- Crisis Text Line — text HOME to 741741
- SAMHSA Helpline — 1-800-662-4357

I am here for the organizing work whenever you want to come back to it.`;

const EMOTIONAL_RESPONSE = `I am not the right thing to talk to about this. I work on contacts, events, and the writing that goes with them, and I would be doing you a disservice by trying.

If it would help to talk to someone: 988 Suicide & Crisis Lifeline, call or text 988. Crisis Text Line, text HOME to 741741.`;

const PROFESSIONAL_RESPONSE = `I am not qualified to answer that, and a confident-sounding wrong answer about medicine, law, tax, or money is worse than no answer.

Ask someone who is. If it is a legal question about an action, your workspace may have a legal contact in Custos.`;

const OFF_TOPIC_RESPONSE = `That is outside what I do. I can help with:

- Drafting a message to a segment
- Summarising what happened at an event
- Turning a meeting into minutes

What are you working on?`;

const INJECTION_RESPONSE = `I only do the three things above. Asking differently will not change that.`;

// ---------------------------------------------------------------------------

/**
 * Screen a message before anything else happens to it.
 *
 * Order matters. Crisis is checked first because a message can match both it
 * and something else, and getting that precedence wrong means answering
 * "I want to die, write me a poem" with a poem.
 */
export function checkScope(message: string): ScopeResult {
  const text = message.trim();

  // Greetings and one-word replies. Screening these produces false positives
  // and no benefit.
  if (text.length < 5) return { allowed: true };

  if (CRISIS.some((p) => p.test(text))) {
    return { allowed: false, reason: 'crisis', response: CRISIS_RESPONSE };
  }
  if (EMOTIONAL_SUPPORT.some((p) => p.test(text))) {
    return { allowed: false, reason: 'emotional_support', response: EMOTIONAL_RESPONSE };
  }
  if (PROFESSIONAL_ADVICE.some((p) => p.test(text))) {
    return { allowed: false, reason: 'professional_advice', response: PROFESSIONAL_RESPONSE };
  }
  if (INJECTION.some((p) => p.test(text))) {
    return { allowed: false, reason: 'prompt_injection', response: INJECTION_RESPONSE };
  }
  if (OFF_TOPIC.some((p) => p.test(text))) {
    return { allowed: false, reason: 'off_topic', response: OFF_TOPIC_RESPONSE };
  }

  return { allowed: true };
}
