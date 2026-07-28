/**
 * vigiliaAuthority — Internal→SEO Translation Layer.
 *
 * WHAT: Converts aggregated Vigilia awareness signals into anonymized narrative themes
 *       for powering SEO authority content, archetype pages, and Communio directory storytelling.
 * WHERE: Consumed by Operator Narrative Studio, SEO authority engine, and Living Archetypes.
 * WHY: CROS authority content should feel organic — grown from real ecosystem patterns,
 *       never manufactured. This bridge ensures privacy-safe narrative translation.
 */
import { supabase } from '@/integrations/supabase/client';
import { guardNarrativeText } from '@/hooks/usePublicNarrativeGuard';
import { getSentryErrorCount } from '@/lib/sentry/queryCounts';

/* ─── Types ─────────────────────────────────────── */

export type NarrativeTone = 'hopeful' | 'steady' | 'emerging' | 'reflective';

export type SuggestedUse =
  | 'authority_article'
  | 'week_in_life'
  | 'archetype_story'
  | 'communio_spotlight'
  | 'field_journal';

export interface NarrativeTheme {
  theme: string;
  tone: NarrativeTone;
  suggestedUse: SuggestedUse[];
  strength: number; // 0-1 confidence in the pattern
  generatedAt: string;
}

export interface AuthorityTranslation {
  themes: NarrativeTheme[];
  ecosystemTone: NarrativeTone;
  generatedAt: string;
}

/* ─── Privacy Constants ─────────────────────────── */

/** Minimum signal count before a pattern is surfaceable */
const MIN_PATTERN_THRESHOLD = 3;

/** Patterns must come from at least this many distinct sources */
const MIN_DISTINCT_SOURCES = 2;

/* ─── Helpers ────────────────────────────────────── */

const weekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const monthAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

function deriveEcosystemTone(
  growthSignals: number,
  frictionSignals: number,
  communioActivity: number,
): NarrativeTone {
  if (growthSignals > 5 && communioActivity > 3) return 'hopeful';
  if (frictionSignals > growthSignals) return 'reflective';
  if (growthSignals > 0 || communioActivity > 0) return 'emerging';
  return 'steady';
}

/** Ensures a theme string contains no PII before it leaves the translation layer */
function safeTheme(text: string): string | null {
  const result = guardNarrativeText(text);
  return result.safe ? result.text : null;
}

/* ─── Core Query: Aggregate Signals ─────────────── */

async function fetchAggregatedSignals() {
  const wa = weekAgo();
  const ma = monthAgo();

  const [
    lumen,
    livingSignals,
    friction,
    communioMetrics,
    activationProgress,
    archetypeRollups,
  ] = await Promise.all([
    // Lumen signals by type (week)
    supabase
      .from('lumen_signals')
      .select('signal_type, severity')
      .gte('created_at', wa)
      .limit(100),
    // Living system signals (week)
    supabase
      .from('living_system_signals')
      .select('signal_type, signal_data')
      .gte('created_at', wa)
      .limit(100),
    // Friction aggregate (week) — now sourced from Sentry (system_error_events retired)
    getSentryErrorCount({ sinceHoursAgo: 24 * 7 }),
    // Communio group metrics (month)
    supabase
      .from('communio_group_metrics')
      .select('signals_shared_count, events_shared_count, tenant_count')
      .gte('week_start', ma)
      .limit(20),
    // Activation checklist progress (month)
    supabase
      .from('activation_checklists')
      .select('readiness_score, status')
      .limit(50),
    // Archetype signal rollups (month)
    supabase
      .from('archetype_signal_rollups')
      .select('archetype_key, reflection_volume, visit_activity, event_presence, momentum_growth')
      .gte('period_start', ma)
      .limit(20),
  ]);

  return {
    lumen: lumen.data ?? [],
    livingSignals: livingSignals.data ?? [],
    frictionCount: friction,
    communioMetrics: communioMetrics.data ?? [],
    activationProgress: activationProgress.data ?? [],
    archetypeRollups: archetypeRollups.data ?? [],
  };
}

/* ─── Theme Generators ──────────────────────────── */

function generateLumenThemes(signals: any[]): NarrativeTheme[] {
  const themes: NarrativeTheme[] = [];
  const byType: Record<string, number> = {};

  for (const s of signals) {
    byType[s.signal_type] = (byType[s.signal_type] || 0) + 1;
  }

  if ((byType['expansion_ready'] ?? 0) >= MIN_PATTERN_THRESHOLD) {
    themes.push({
      theme: 'Communities are showing signs of readiness to grow',
      tone: 'hopeful',
      suggestedUse: ['authority_article', 'archetype_story'],
      strength: Math.min(1, (byType['expansion_ready'] ?? 0) / 10),
      generatedAt: new Date().toISOString(),
    });
  }

  if ((byType['adoption_milestone'] ?? 0) >= MIN_PATTERN_THRESHOLD) {
    themes.push({
      theme: 'Adoption milestones are being reached across the ecosystem',
      tone: 'hopeful',
      suggestedUse: ['week_in_life', 'field_journal'],
      strength: Math.min(1, (byType['adoption_milestone'] ?? 0) / 8),
      generatedAt: new Date().toISOString(),
    });
  }

  return themes;
}

function generateLivingSignalThemes(signals: any[]): NarrativeTheme[] {
  const themes: NarrativeTheme[] = [];
  const byType: Record<string, number> = {};

  for (const s of signals) {
    byType[s.signal_type] = (byType[s.signal_type] || 0) + 1;
  }

  if ((byType['reflection_moment'] ?? 0) >= MIN_PATTERN_THRESHOLD) {
    themes.push({
      theme: 'Reflective practice is deepening across communities',
      tone: 'reflective',
      suggestedUse: ['authority_article', 'field_journal'],
      strength: Math.min(1, (byType['reflection_moment'] ?? 0) / 10),
      generatedAt: new Date().toISOString(),
    });
  }

  if ((byType['community_growth'] ?? 0) >= MIN_PATTERN_THRESHOLD) {
    themes.push({
      theme: 'Community presence is growing in new neighborhoods',
      tone: 'emerging',
      suggestedUse: ['week_in_life', 'archetype_story'],
      strength: Math.min(1, (byType['community_growth'] ?? 0) / 8),
      generatedAt: new Date().toISOString(),
    });
  }

  if ((byType['collaboration_movement'] ?? 0) >= MIN_PATTERN_THRESHOLD) {
    themes.push({
      theme: 'Organizations are finding each other and building together',
      tone: 'hopeful',
      suggestedUse: ['communio_spotlight', 'authority_article'],
      strength: Math.min(1, (byType['collaboration_movement'] ?? 0) / 6),
      generatedAt: new Date().toISOString(),
    });
  }

  return themes;
}

function generateCommunioThemes(metrics: any[]): NarrativeTheme[] {
  const themes: NarrativeTheme[] = [];

  const totalShared = metrics.reduce((sum: number, m: any) => sum + (m.signals_shared_count ?? 0), 0);
  const totalEvents = metrics.reduce((sum: number, m: any) => sum + (m.events_shared_count ?? 0), 0);
  const distinctGroups = metrics.length;

  if (totalShared >= MIN_PATTERN_THRESHOLD && distinctGroups >= MIN_DISTINCT_SOURCES) {
    themes.push({
      theme: 'Cross-community signal sharing is becoming a natural rhythm',
      tone: 'hopeful',
      suggestedUse: ['communio_spotlight', 'authority_article'],
      strength: Math.min(1, totalShared / 20),
      generatedAt: new Date().toISOString(),
    });
  }

  if (totalEvents >= MIN_PATTERN_THRESHOLD && distinctGroups >= MIN_DISTINCT_SOURCES) {
    themes.push({
      theme: 'Communities are gathering around shared events',
      tone: 'emerging',
      suggestedUse: ['week_in_life', 'communio_spotlight'],
      strength: Math.min(1, totalEvents / 15),
      generatedAt: new Date().toISOString(),
    });
  }

  return themes;
}

function generateArchetypeThemes(rollups: any[]): NarrativeTheme[] {
  const themes: NarrativeTheme[] = [];

  for (const r of rollups) {
    if (r.reflection_volume >= MIN_PATTERN_THRESHOLD && r.visit_activity >= MIN_PATTERN_THRESHOLD) {
      const archLabel = (r.archetype_key as string).replace(/_/g, ' ');
      const text = safeTheme(`${archLabel} communities are deepening both reflection and presence`);
      if (text) {
        themes.push({
          theme: text,
          tone: 'reflective',
          suggestedUse: ['archetype_story', 'field_journal'],
          strength: Math.min(1, (r.reflection_volume + r.visit_activity) / 20),
          generatedAt: new Date().toISOString(),
        });
      }
    }

    if (r.momentum_growth > 0 && r.event_presence >= MIN_PATTERN_THRESHOLD) {
      const archLabel = (r.archetype_key as string).replace(/_/g, ' ');
      const text = safeTheme(`${archLabel} organizations show growing event momentum`);
      if (text) {
        themes.push({
          theme: text,
          tone: 'hopeful',
          suggestedUse: ['authority_article', 'week_in_life'],
          strength: Math.min(1, r.momentum_growth / 5),
          generatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return themes;
}

function generateActivationThemes(progress: any[]): NarrativeTheme[] {
  const themes: NarrativeTheme[] = [];
  const completed = progress.filter((p: any) => p.status === 'completed');
  const avgScore = progress.length > 0
    ? progress.reduce((sum: number, p: any) => sum + (p.readiness_score ?? 0), 0) / progress.length
    : 0;

  if (completed.length >= MIN_PATTERN_THRESHOLD) {
    themes.push({
      theme: 'New communities are completing their activation journeys',
      tone: 'hopeful',
      suggestedUse: ['authority_article', 'archetype_story'],
      strength: Math.min(1, completed.length / 10),
      generatedAt: new Date().toISOString(),
    });
  }

  if (avgScore > 70 && progress.length >= MIN_DISTINCT_SOURCES) {
    themes.push({
      theme: 'Platform readiness is high — organizations are settling in well',
      tone: 'steady',
      suggestedUse: ['field_journal', 'week_in_life'],
      strength: Math.min(1, avgScore / 100),
      generatedAt: new Date().toISOString(),
    });
  }

  return themes;
}

/* ─── Public API ─────────────────────────────────── */

/**
 * getNarrativeThemes — The primary translation function.
 *
 * Aggregates all signal sources, applies privacy thresholds,
 * and produces anonymized narrative themes for SEO authority content.
 */
export async function getNarrativeThemes(): Promise<AuthorityTranslation> {
  const signals = await fetchAggregatedSignals();

  const allThemes: NarrativeTheme[] = [
    ...generateLumenThemes(signals.lumen),
    ...generateLivingSignalThemes(signals.livingSignals),
    ...generateCommunioThemes(signals.communioMetrics),
    ...generateArchetypeThemes(signals.archetypeRollups),
    ...generateActivationThemes(signals.activationProgress),
  ];

  // Sort by strength descending — strongest patterns surface first
  allThemes.sort((a, b) => b.strength - a.strength);

  // Final privacy pass: re-validate all theme text
  const safeThemes = allThemes.filter((t) => {
    const check = guardNarrativeText(t.theme);
    return check.safe;
  });

  const ecosystemTone = deriveEcosystemTone(
    signals.lumen.length,
    signals.frictionCount,
    signals.communioMetrics.reduce((s: number, m: any) => s + (m.signals_shared_count ?? 0), 0),
  );

  return {
    themes: safeThemes,
    ecosystemTone,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * getThemesForUse — Filter themes by suggested use case.
 */
export function getThemesForUse(
  translation: AuthorityTranslation,
  use: SuggestedUse,
): NarrativeTheme[] {
  return translation.themes.filter((t) => t.suggestedUse.includes(use));
}

/**
 * getThemesByTone — Filter themes by narrative tone.
 */
export function getThemesByTone(
  translation: AuthorityTranslation,
  tone: NarrativeTone,
): NarrativeTheme[] {
  return translation.themes.filter((t) => t.tone === tone);
}
