/**
 * CROS™ Narrative Voice Validator — Spanish (es)
 *
 * Ensures all NRI Companion output in Spanish maintains the pastoral,
 * contemplative, Ignatian tone. Blocks urgency patterns, marketing
 * language, and gamification vocabulary.
 *
 * Register: Formal (usted)
 * Tradition: Ignatian spirituality
 * Metaphor family: garden, seasons, journey, light, silence
 */

export interface VoiceValidationResult {
  isValid: boolean;
  violations: VoiceViolation[];
  correctedText?: string;
}

export interface VoiceViolation {
  type: 'urgency' | 'marketing' | 'gamification' | 'informal_register' | 'manipulation';
  pattern: string;
  matchedText: string;
  suggestion: string;
}

/**
 * Urgency patterns — language that creates false pressure.
 * The NRI voice is never urgent. It is patient and inviting.
 */
const URGENCY_PATTERNS_ES: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\b(actúe|actúa|actuar)\s+(ahora|ya|de inmediato)\b/gi, suggestion: 'Le invitamos a considerar...' },
  { pattern: /\burgente(mente)?\b/gi, suggestion: 'cuando sea oportuno' },
  { pattern: /\búltima\s+oportunidad\b/gi, suggestion: 'una oportunidad que se presenta' },
  { pattern: /\bno\s+(se\s+)?pierda\b/gi, suggestion: 'quizá le interese' },
  { pattern: /\bapresúrese\b/gi, suggestion: 'a su tiempo' },
  { pattern: /\bantes\s+de\s+que\s+sea\s+tarde\b/gi, suggestion: 'cuando sienta que es el momento' },
  { pattern: /\bahora\s+o\s+nunca\b/gi, suggestion: 'cuando esté preparado' },
  { pattern: /\bdate\s+prisa\b/gi, suggestion: 'a su propio ritmo' },
  { pattern: /\bno\s+espere\s+más\b/gi, suggestion: 'cuando lo considere oportuno' },
  { pattern: /\btiempo\s+limitado\b/gi, suggestion: 'una invitación abierta' },
  { pattern: /\bsolo\s+por\s+hoy\b/gi, suggestion: 'hoy y siempre' },
  { pattern: /\b(cupo|cupos)\s+limitado(s)?\b/gi, suggestion: 'espacio disponible' },
  { pattern: /\bno\s+lo\s+deje\s+pasar\b/gi, suggestion: 'considere esta posibilidad' },
  { pattern: /\b¡+\s*/g, suggestion: '— (use em dash for gentle emphasis)' },
];

/**
 * Marketing patterns — sales language that treats people as prospects.
 * The NRI voice never sells. It accompanies.
 */
const MARKETING_PATTERNS_ES: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\boferta\s+(especial|exclusiva|irrepetible)\b/gi, suggestion: 'una posibilidad' },
  { pattern: /\bgratis\b/gi, suggestion: 'sin costo' },
  { pattern: /\bdescuento\b/gi, suggestion: 'accesible' },
  { pattern: /\bpromoción\b/gi, suggestion: 'invitación' },
  { pattern: /\bgarantizado\b/gi, suggestion: 'con confianza' },
  { pattern: /\bcompre\s+ahora\b/gi, suggestion: 'considere' },
  { pattern: /\bresultados\s+(garantizados|inmediatos|comprobados)\b/gi, suggestion: 'frutos a su tiempo' },
  { pattern: /\b(el|la)\s+mejor\s+del\s+mercado\b/gi, suggestion: 'al servicio de su comunidad' },
  { pattern: /\bno\s+se\s+arrepentirá\b/gi, suggestion: 'puede ser de bendición' },
  { pattern: /\bincreíble\b/gi, suggestion: 'significativo' },
  { pattern: /\bimpresionante\b/gi, suggestion: 'profundo' },
  { pattern: /\bsuscríbase\s+ahora\b/gi, suggestion: 'le acompañamos cuando esté listo' },
  { pattern: /\baprovech[ea]\b/gi, suggestion: 'considere' },
];

/**
 * Gamification patterns — language that reduces relationships to points and scores.
 * The NRI voice does not gamify human connection.
 */
const GAMIFICATION_PATTERNS_ES: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\bpuntos?\b/gi, suggestion: 'pasos en el camino' },
  { pattern: /\bnivel(es)?\b/gi, suggestion: 'etapa' },
  { pattern: /\bclasificación\b/gi, suggestion: 'estado del camino' },
  { pattern: /\branking\b/gi, suggestion: 'reconocimiento' },
  { pattern: /\bcompetencia\b/gi, suggestion: 'colaboración' },
  { pattern: /\bganar\b/gi, suggestion: 'crecer' },
  { pattern: /\bperder\b/gi, suggestion: 'aprender' },
  { pattern: /\bracha\b/gi, suggestion: 'constancia' },
  { pattern: /\bdesbloque(ar|ado)\b/gi, suggestion: 'descubrir' },
  { pattern: /\blogro(s)?\b/gi, suggestion: 'hito(s) del camino' },
  { pattern: /\brecompensa\b/gi, suggestion: 'fruto' },
  { pattern: /\bbadge\b/gi, suggestion: 'reconocimiento' },
  { pattern: /\btrofeo\b/gi, suggestion: 'gratitud' },
];

/**
 * Informal register patterns — catches tú forms that should be usted.
 * The NRI voice uses usted consistently as a sign of pastoral respect.
 */
const INFORMAL_REGISTER_PATTERNS_ES: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\btienes\b/gi, suggestion: 'tiene' },
  { pattern: /\bquieres\b/gi, suggestion: 'desea' },
  { pattern: /\bpuedes\b/gi, suggestion: 'puede' },
  { pattern: /\bnecesitas\b/gi, suggestion: 'necesita' },
  { pattern: /\bsabes\b/gi, suggestion: 'sabe' },
  { pattern: /\bpiensas\b/gi, suggestion: 'considera' },
  { pattern: /\bhaces\b/gi, suggestion: 'hace' },
  { pattern: /\bvienes\b/gi, suggestion: 'viene' },
  { pattern: /\bmira\b/gi, suggestion: 'observe' },
  { pattern: /\bhaz\b/gi, suggestion: 'haga' },
  { pattern: /\bven\b/gi, suggestion: 'venga' },
  { pattern: /\bdime\b/gi, suggestion: 'dígame' },
  { pattern: /\btu\s/gi, suggestion: 'su ' },
  { pattern: /\btus\s/gi, suggestion: 'sus ' },
  { pattern: /\bte\s+(invito|sugiero|propongo)\b/gi, suggestion: 'le $1' },
];

/**
 * Manipulation patterns — emotional pressure tactics.
 * The NRI voice respects autonomy absolutely.
 */
const MANIPULATION_PATTERNS_ES: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\b(no\s+)?debería\s+(sentirse|tener)\s+(culpa|vergüenza)\b/gi, suggestion: '(remove guilt/shame framing entirely)' },
  { pattern: /\btodos\s+lo\s+están\s+haciendo\b/gi, suggestion: 'algunos en su comunidad han encontrado valor en...' },
  { pattern: /\bsi\s+realmente\s+le\s+importa\b/gi, suggestion: 'si lo siente en su corazón' },
  { pattern: /\bno\s+sea\s+(cobarde|débil|flojo)\b/gi, suggestion: '(remove entirely — never use shame)' },
  { pattern: /\bqué\s+dirán\b/gi, suggestion: '(remove social pressure framing)' },
  { pattern: /\bse\s+lo\s+merece\b/gi, suggestion: 'es un regalo' },
];

/**
 * Validate a string of NRI Companion output against the Spanish voice guidelines.
 */
export function validateNarrativeVoice(text: string): VoiceValidationResult {
  const violations: VoiceViolation[] = [];

  const allPatterns: Array<{
    type: VoiceViolation['type'];
    patterns: Array<{ pattern: RegExp; suggestion: string }>;
  }> = [
    { type: 'urgency', patterns: URGENCY_PATTERNS_ES },
    { type: 'marketing', patterns: MARKETING_PATTERNS_ES },
    { type: 'gamification', patterns: GAMIFICATION_PATTERNS_ES },
    { type: 'informal_register', patterns: INFORMAL_REGISTER_PATTERNS_ES },
    { type: 'manipulation', patterns: MANIPULATION_PATTERNS_ES },
  ];

  for (const { type, patterns } of allPatterns) {
    for (const { pattern, suggestion } of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        violations.push({
          type,
          pattern: pattern.source,
          matchedText: match[0],
          suggestion,
        });
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Quick check — returns true if text passes all voice guidelines.
 */
export function isValidNarrativeVoice(text: string): boolean {
  return validateNarrativeVoice(text).isValid;
}

/**
 * Get a summary of violations grouped by type.
 */
export function getViolationSummary(result: VoiceValidationResult): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const v of result.violations) {
    summary[v.type] = (summary[v.type] || 0) + 1;
  }
  return summary;
}

/**
 * Approved pastoral vocabulary — words and phrases that embody the NRI voice in Spanish.
 */
export const PASTORAL_VOCABULARY_ES = {
  verbs: [
    'acompañar', 'cultivar', 'contemplar', 'discernir', 'escuchar',
    'florecer', 'iluminar', 'invitar', 'nutrir', 'observar',
    'ofrecer', 'permanecer', 'plantar', 'reflexionar', 'sembrar',
    'servir', 'sostener', 'tender', 'velar', 'caminar',
  ],
  nouns: [
    'camino', 'comunidad', 'compañero', 'cosecha', 'don',
    'encuentro', 'estación', 'fidelidad', 'fruto', 'gracia',
    'gratitud', 'jardín', 'luz', 'presencia', 'raíz',
    'reflexión', 'semilla', 'silencio', 'vínculo', 'vocación',
  ],
  adjectives: [
    'callado', 'constante', 'contemplativo', 'fecundo', 'fiel',
    'generoso', 'humilde', 'luminoso', 'paciente', 'pastoral',
    'profundo', 'quieto', 'sagrado', 'sereno', 'tierno',
  ],
  phrases: [
    'a su tiempo',
    'con paciencia y ternura',
    'en el silencio del corazón',
    'paso a paso en el camino',
    'cada persona importa',
    'demos gracias a Dios',
    'la presencia fiel',
    'estación tras estación',
    'las raíces más profundas crecen en el silencio',
    'ver con los ojos del corazón',
  ],
} as const;

export default {
  validateNarrativeVoice,
  isValidNarrativeVoice,
  getViolationSummary,
  PASTORAL_VOCABULARY_ES,
};
