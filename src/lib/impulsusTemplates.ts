/**
 * Impulsus — deterministic first-person narrative templates + source sanitizer.
 *
 * WHAT: Generates gentle, first-person scrapbook entries for 7 capture kinds.
 * WHERE: Called by useImpulsusCapture before every insert.
 * WHY: Keeps narrative tone consistent and avoids any AI dependency.
 */

export type ImpulsusKind =
  | 'reflection'
  | 'email'
  | 'campaign'
  | 'ai_suggestion'
  | 'event'
  | 'journey'
  | 'task';

export interface ImpulsusContext {
  orgName?: string;
  eventName?: string;
  fromStage?: string;
  toStage?: string;
  subject?: string;
  taskTitle?: string;
  reflectionSnippet?: string;
}

interface GeneratedEntry {
  title: string;
  narrative: string;
  tags: string[];
}

const FORBIDDEN_KEYS = ['body', 'html', 'raw', 'full_text', 'note_text'];

function org(ctx: ImpulsusContext): string {
  return ctx.orgName || 'this partner';
}

const templates: Record<ImpulsusKind, (ctx: ImpulsusContext) => GeneratedEntry> = {
  reflection: (ctx) => ({
    title: 'I left a reflection',
    narrative: `I wrote down what I noticed about ${org(ctx)}.${ctx.reflectionSnippet ? ` "${ctx.reflectionSnippet.slice(0, 80)}…"` : ''}`,
    tags: ['reflection'],
  }),

  email: (ctx) => ({
    title: 'I reached out',
    narrative: `I sent a note to ${org(ctx)}.${ctx.subject ? ` Subject: "${ctx.subject}".` : ''}`,
    tags: ['email', 'outreach'],
  }),

  campaign: (ctx) => ({
    title: 'I made a touchpoint',
    narrative: `I included ${org(ctx)} in a campaign touch.${ctx.subject ? ` Subject: "${ctx.subject}".` : ''}`,
    tags: ['campaign', 'outreach'],
  }),

  ai_suggestion: (ctx) => ({
    title: 'I followed a nudge',
    narrative: `I took Profunda's suggestion and acted on it for ${org(ctx)}.`,
    tags: ['ai', 'suggestion'],
  }),

  event: (ctx) => ({
    title: 'I showed up in the community',
    narrative: `I attended ${ctx.eventName ? `"${ctx.eventName}"` : 'an event'} and was present for the work.`,
    tags: ['event', 'community'],
  }),

  journey: (ctx) => ({
    title: 'I moved the journey forward',
    narrative: `I moved ${org(ctx)} from "${ctx.fromStage || '?'}" to "${ctx.toStage || '?'}".`,
    tags: ['journey', 'stage-change'],
  }),

  task: (ctx) => ({
    title: 'I captured an action',
    narrative: `I pulled an action item out of a conversation with ${org(ctx)}.${ctx.taskTitle ? ` "${ctx.taskTitle}".` : ''}`,
    tags: ['task', 'action'],
  }),
};

export function generateImpulsusEntry(kind: ImpulsusKind, context: ImpulsusContext = {}): GeneratedEntry {
  const template = templates[kind];
  if (!template) {
    return { title: 'I did something', narrative: 'I took an action in the system.', tags: [kind] };
  }
  return template(context);
}

/**
 * Recursively strips forbidden keys from a JSON-like object.
 * Returns a new object safe for impulsus_entries.source.
 */
export function sanitizeImpulsusSource(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined || typeof input !== 'object') {
    return {};
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeValue(item)) as unknown as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key)) continue;
    result[key] = sanitizeValue(value);
  }
  return result;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(k)) continue;
    result[k] = sanitizeValue(v);
  }
  return result;
}
