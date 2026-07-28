/**
 * NRI Scope Guardrails — Client-side message pre-screening.
 *
 * WHAT: Validates user messages before sending to NRI to ensure they stay
 *       within the platform's relational/organizational scope.
 * WHERE: Called by useSendChatMessage before making the edge function call.
 * WHY: Prevents misuse of NRI as a free-form chatbot, general knowledge tool,
 *      or emotional support service. Protects both the user and system resources.
 */

export interface ScopeCheckResult {
  allowed: boolean;
  reason?: string;
  /** Gentle response to show the user instead of sending to AI */
  gentleResponse?: string;
}

// ─── Emotional / Crisis Topics ───────────────────────────
// These deserve real help, not an AI — we redirect gently.
const EMOTIONAL_CRISIS_PATTERNS = [
  /\b(suicid|kill myself|end my life|want to die|don'?t want to live)\b/i,
  /\b(self.?harm|cutting myself|hurt myself)\b/i,
  /\b(abuse|abused|abusing|domestic violence|sexual assault)\b/i,
  /\b(eating disorder|anorexia|bulimia)\b/i,
  /\b(addiction|addicted|substance abuse|drug problem|alcoholi[sc])\b/i,
  /\b(panic attack|anxiety attack|mental breakdown)\b/i,
  /\b(depressed|depression|feel hopeless|feel worthless)\b/i,
];

// ─── Therapy / Counseling Seeking ────────────────────────
const EMOTIONAL_SUPPORT_PATTERNS = [
  /\b(i feel (so )?(sad|lonely|anxious|scared|depressed|overwhelmed|broken|empty|lost))\b/i,
  /\b(i need (someone to talk to|emotional support|therapy|counseling|help with my feelings))\b/i,
  /\b(can you (be my|act as a) (therapist|counselor|psychologist))\b/i,
  /\b(my (marriage|relationship|divorce|breakup|spouse|partner))\b/i,
  /\b(i'?m (going through|dealing with|struggling with) (a lot|something|grief|loss))\b/i,
  /\b(listen to me vent|need to vent|just need to talk)\b/i,
];

// ─── General Knowledge / Free-form Chat ──────────────────
const FREEFORM_PATTERNS = [
  /\b(write me (a |an )?(poem|song|story|essay|joke|haiku|limerick))\b/i,
  /\b(tell me (a |about )?(joke|riddle|fun fact|story about))\b/i,
  /\b(what is the (meaning of life|capital of|population of|weather|stock price))\b/i,
  /\b(who (is|was) (the president|elon musk|taylor swift|trump|biden))\b/i,
  /\b(explain (quantum|relativity|blockchain|cryptocurrency|bitcoin))\b/i,
  /\b(help me with (my homework|an essay|a paper|code|coding|programming))\b/i,
  /\b(write (code|python|javascript|html|css|sql|a program))\b/i,
  /\b(translate .{3,} (to|into) (spanish|french|german|chinese|japanese))\b/i,
  /\b(recipe for|how to cook|how to bake)\b/i,
  /\b(play (a game|20 questions|trivia|would you rather))\b/i,
  /\b(roleplay|pretend (you are|to be)|act as (a |an )?(?!steward|shepherd|companion))\b/i,
  /\b(what do you think about|your opinion on|do you believe)\b/i,
  /\b(are you (sentient|conscious|alive|real|human))\b/i,
  /ignore .{0,20}(instructions|rules|prompt|system)/i,
  /\b(jailbreak|dan mode|developer mode|bypass)\b/i,
];

// ─── Medical / Legal Advice ──────────────────────────────
const PROFESSIONAL_ADVICE_PATTERNS = [
  /\b(diagnos|symptom|medication|prescri|medical advice)\b/i,
  /\b(legal advice|sue |lawsuit|attorney|lawyer)\b/i,
  /\b(tax advice|tax return|file my taxes)\b/i,
  /\b(invest|stock|crypto|trading advice)\b/i,
];

const CRISIS_RESPONSE = `I can see you may be going through something difficult. I'm not equipped to help with personal emotional matters — I'm here for your organization's relational work.

If you or someone you know needs support:
• **988 Suicide & Crisis Lifeline**: Call or text **988**
• **Crisis Text Line**: Text **HOME** to **741741**
• **SAMHSA Helpline**: **1-800-662-4357**

You matter. Please reach out to someone who can truly help.`;

const EMOTIONAL_RESPONSE = `I appreciate you sharing that with me. I'm here to help with your organization's relationships, community work, and platform questions — but I'm not the right companion for personal emotional support.

If you're looking for someone to talk to, please consider reaching out to a trusted friend, counselor, or one of these resources:
• **988 Suicide & Crisis Lifeline**: Call or text **988**
• **Crisis Text Line**: Text **HOME** to **741741**

Is there anything about your organizational work I can help with?`;

const FREEFORM_RESPONSE = `I'm NRI — your organization's relational intelligence companion. I can help with things like:

• **Your partners and people** — "Who haven't I connected with recently?"
• **Logging activities** — "Log a meeting with Sarah at Habitat"
• **Platform navigation** — "How do I set up email campaigns?"
• **Creating records** — "Add a new partner called Unity Health"
• **Reflections and insights** — "Write a reflection about today's visit"

What would you like to do for your organization?`;

const PROFESSIONAL_RESPONSE = `I'm not qualified to provide medical, legal, tax, or financial advice. I'm here to help with your organization's relational work within CROS.

Please consult a qualified professional for that kind of guidance. Is there anything about your community relationships or the platform I can help with?`;

/**
 * Pre-screen a user message for NRI scope compliance.
 * Returns immediately if the message is out of scope.
 */
export function checkNriScope(message: string): ScopeCheckResult {
  const trimmed = message.trim();

  // Very short messages are likely greetings — allow them
  if (trimmed.length < 5) {
    return { allowed: true };
  }

  // Check crisis topics FIRST — these need immediate, compassionate redirection
  for (const pattern of EMOTIONAL_CRISIS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'crisis_topic',
        gentleResponse: CRISIS_RESPONSE,
      };
    }
  }

  // Check emotional support seeking
  for (const pattern of EMOTIONAL_SUPPORT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'emotional_support',
        gentleResponse: EMOTIONAL_RESPONSE,
      };
    }
  }

  // Check professional advice seeking
  for (const pattern of PROFESSIONAL_ADVICE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'professional_advice',
        gentleResponse: PROFESSIONAL_RESPONSE,
      };
    }
  }

  // Check free-form / general knowledge
  for (const pattern of FREEFORM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'off_topic',
        gentleResponse: FREEFORM_RESPONSE,
      };
    }
  }

  // Check prompt injection attempts
  if (/ignore .{0,20}(instructions|rules|prompt|system)/i.test(trimmed) ||
      /\b(jailbreak|dan mode|developer mode)\b/i.test(trimmed) ||
      /\bbypass\b/i.test(trimmed)) {
    return {
      allowed: false,
      reason: 'prompt_injection',
      gentleResponse: FREEFORM_RESPONSE,
    };
  }

  return { allowed: true };
}
