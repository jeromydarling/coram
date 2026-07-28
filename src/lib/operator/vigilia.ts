/**
 * Vigilia — The hidden fifth zone: Operator Narrative Awareness Layer.
 *
 * WHAT: Aggregates signals from lumen, friction, QA, activation, communio,
 *       and adoption into human-readable narrative summaries.
 * WHERE: Consumed by useVigilia hook and surfaced across all 4 operator zones.
 * WHY: The Operator should feel like a steward observing life,
 *       not an engineer monitoring logs. Vigilia is The Watch.
 */
import { supabase } from '@/integrations/supabase/client';
import { getSentryErrorCount } from '@/lib/sentry/queryCounts';

/* ─── Types ─────────────────────────────────────── */

export type VigiliaToне = 'steady' | 'watchful' | 'active';

export interface VigiliaHighlight {
  text: string;
  category: 'activation' | 'growth' | 'system' | 'narrative' | 'communio';
  link?: string;
}

export interface VigiliaOverview {
  tone: VigiliaToне;
  highlights: VigiliaHighlight[];
  updatedAt: string;
}

export interface ActivationWatch {
  quietTenants: { name: string; daysSilent: number }[];
  pendingActivations: number;
  highlight: string;
}

export interface GrowthWatch {
  highlights: VigiliaHighlight[];
  expandingMetros: number;
  communioActivity: number;
}

export interface SystemWatch {
  highlights: VigiliaHighlight[];
  qaHealth: string;
  automationHealth: string;
  frictionSummary: string;
}

/* ─── Helpers ────────────────────────────────────── */

const dayAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const weekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

function deriveTone(signals: number, issues: number): VigiliaToне {
  if (issues >= 3) return 'active';
  if (signals >= 5 || issues >= 1) return 'watchful';
  return 'steady';
}

/* ─── Core Queries ──────────────────────────────── */

export async function getOperatorAwarenessSummary(): Promise<VigiliaOverview> {
  const highlights: VigiliaHighlight[] = [];
  const wa = weekAgo();
  const da = dayAgo();

  // Parallel fetch of all signal sources
  const [lumen, friction, qa, activation, communio, adoption] = await Promise.all([
    // Lumen signals (week)
    supabase
      .from('lumen_signals')
      .select('signal_type, severity')
      .gte('created_at', wa)
      .limit(50),
    // System friction (24h) — now sourced from Sentry (system_error_events retired)
    getSentryErrorCount({ sinceHoursAgo: 24 }),
    // QA failures (24h)
    supabase
      .from('qa_run_results' as any)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'fail')
      .gte('created_at', da),
    // Pending activations
    supabase
      .from('activation_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    // Communio shared signals (week)
    supabase
      .from('communio_shared_signals')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', wa),
    // Adoption — new tenants (week)
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', wa),
  ]);

  const lumenSignals = lumen.data ?? [];
  const frictionCount = friction;
  const qaFails = qa.count ?? 0;
  const pendingAct = activation.count ?? 0;
  const communioCount = communio.count ?? 0;
  const newTenants = adoption.count ?? 0;

  // Build narrative highlights
  if (newTenants > 0) {
    highlights.push({
      text: `${newTenants} new ${newTenants === 1 ? 'community' : 'communities'} arrived this week`,
      category: 'activation',
      link: '/operator/activation',
    });
  }

  if (pendingAct > 0) {
    highlights.push({
      text: `${pendingAct} activation ${pendingAct === 1 ? 'session awaits' : 'sessions await'} your presence`,
      category: 'activation',
      link: '/operator/nexus/activation',
    });
  }

  const highLumen = lumenSignals.filter((s: any) => s.severity === 'high');
  if (highLumen.length > 0) {
    highlights.push({
      text: `${highLumen.length} signal${highLumen.length > 1 ? 's' : ''} worth closer attention in Lumen`,
      category: 'narrative',
      link: '/operator/lumen',
    });
  }

  if (communioCount > 0) {
    highlights.push({
      text: `Communio sharing is active — ${communioCount} signal${communioCount > 1 ? 's' : ''} exchanged this week`,
      category: 'communio',
      link: '/operator/communio',
    });
  }

  if (frictionCount > 0) {
    highlights.push({
      text: `${frictionCount} friction ${frictionCount === 1 ? 'event' : 'events'} observed — may be worth a glance`,
      category: 'system',
      link: '/operator/nexus/friction',
    });
  }

  if (qaFails > 0) {
    highlights.push({
      text: `${qaFails} QA ${qaFails === 1 ? 'check' : 'checks'} may need attention`,
      category: 'system',
      link: '/operator/qa',
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      text: 'All quiet across the ecosystem. A good day for reflection.',
      category: 'narrative',
    });
  }

  const issueCount = frictionCount + qaFails;
  const signalCount = lumenSignals.length + communioCount + newTenants;

  return {
    tone: deriveTone(signalCount, issueCount),
    highlights,
    updatedAt: new Date().toISOString(),
  };
}

export async function getActivationWatchSignals(): Promise<ActivationWatch> {
  const wa = weekAgo();

  const [pending, quiet] = await Promise.all([
    supabase
      .from('activation_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    // Tenants with no recent activity
    supabase
      .from('tenants')
      .select('name, created_at')
      .lt('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
      .order('created_at', { ascending: true })
      .limit(5),
  ]);

  const quietTenants = (quiet.data ?? []).map((t: any) => ({
    name: t.name,
    daysSilent: Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000),
  }));

  const pendingCount = pending.count ?? 0;
  let highlight = 'All communities are settling in well.';
  if (quietTenants.length > 0) {
    highlight = `${quietTenants.length} ${quietTenants.length === 1 ? 'community' : 'communities'} may benefit from a gentle check-in.`;
  }
  if (pendingCount > 0) {
    highlight = `${pendingCount} activation ${pendingCount === 1 ? 'session' : 'sessions'} waiting. ${highlight}`;
  }

  return {
    quietTenants,
    pendingActivations: pendingCount,
    highlight,
  };
}

export async function getGrowthWatchSignals(): Promise<GrowthWatch> {
  const wa = weekAgo();
  const highlights: VigiliaHighlight[] = [];

  const [expansion, communio, lumen] = await Promise.all([
    supabase
      .from('expansion_signals')
      .select('metro_id', { count: 'exact', head: true })
      .gte('created_at', wa),
    supabase
      .from('communio_shared_signals')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', wa),
    supabase
      .from('lumen_signals')
      .select('signal_type')
      .eq('signal_type', 'expansion_ready')
      .gte('created_at', wa)
      .limit(10),
  ]);

  const expandingMetros = expansion.count ?? 0;
  const communioActivity = communio.count ?? 0;
  const expansionReady = lumen.data?.length ?? 0;

  if (expansionReady > 0) {
    highlights.push({
      text: `${expansionReady} ${expansionReady === 1 ? 'metro shows' : 'metros show'} expansion momentum`,
      category: 'growth',
      link: '/operator/nexus/expansion',
    });
  }

  if (communioActivity > 0) {
    highlights.push({
      text: `Cross-community sharing continues with ${communioActivity} signals this week`,
      category: 'communio',
      link: '/operator/communio',
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      text: 'Growth is steady — no new expansion signals this week.',
      category: 'growth',
    });
  }

  return { highlights, expandingMetros, communioActivity };
}

export async function getSystemWatchSignals(): Promise<SystemWatch> {
  const da = dayAgo();
  const highlights: VigiliaHighlight[] = [];

  const [qaFails, autoErrors, friction] = await Promise.all([
    supabase
      .from('qa_run_results' as any)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'fail')
      .gte('created_at', da),
    supabase
      .from('automation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('created_at', da),
    // System friction (24h) — now sourced from Sentry (system_error_events retired)
    getSentryErrorCount({ sinceHoursAgo: 24 }),
  ]);

  const qaCount = qaFails.count ?? 0;
  const autoCount = autoErrors.count ?? 0;
  const frictionCount = friction;

  const qaHealth = qaCount === 0 ? 'All tests passing' : `${qaCount} test${qaCount > 1 ? 's' : ''} may need attention`;
  const automationHealth = autoCount === 0 ? 'Workflows running smoothly' : `${autoCount} workflow${autoCount > 1 ? 's' : ''} paused`;
  const frictionSummary = frictionCount === 0 ? 'No friction detected today' : `${frictionCount} event${frictionCount > 1 ? 's' : ''} worth a glance`;

  if (qaCount > 0) {
    highlights.push({ text: qaHealth, category: 'system', link: '/operator/qa' });
  }
  if (autoCount > 0) {
    highlights.push({ text: automationHealth, category: 'system', link: '/operator/automation' });
  }
  if (frictionCount > 0) {
    highlights.push({ text: frictionSummary, category: 'system', link: '/operator/nexus/friction' });
  }

  if (highlights.length === 0) {
    highlights.push({
      text: 'All systems are running calmly. Nothing needs attention right now.',
      category: 'system',
    });
  }

  return { highlights, qaHealth, automationHealth, frictionSummary };
}
