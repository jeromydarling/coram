/**
 * buildLumenNarrative — Human-centered narrative for Lumen signals.
 *
 * WHAT: Converts raw lumen_signals into warm, descriptive operator copy.
 * WHERE: Used in Lumen dashboard cards and pulse summaries.
 * WHY: Operators read stories, not data tables. Never predictive language.
 */

interface LumenSignalRow {
  signal_type: string;
  severity: string;
  confidence: number;
  source_summary: Record<string, unknown>;
  tenant_name?: string;
  metro_name?: string;
}

const typeLabels: Record<string, string> = {
  drift_risk: 'Needs care',
  activation_delay: 'Slow sprouting',
  migration_fragility: 'Needs attention',
  volunteer_dropoff: 'Rhythm shifting',
  expansion_ready: 'New growth forming',
  narrative_surge: 'Momentum rising',
};

const severityAdverbs: Record<string, string> = {
  low: 'gently',
  medium: 'noticeably',
  high: 'meaningfully',
};

export function buildLumenNarrative(signal: LumenSignalRow): string {
  const label = typeLabels[signal.signal_type] || 'A pattern is forming';
  const adverb = severityAdverbs[signal.severity] || 'quietly';
  const location = signal.metro_name
    ? ` in ${signal.metro_name}`
    : signal.tenant_name
      ? ` for ${signal.tenant_name}`
      : '';

  switch (signal.signal_type) {
    case 'drift_risk': {
      const drop = signal.source_summary?.reflection_drop_pct ?? 0;
      return `Reflections have ${adverb} slowed${location} — down about ${drop}% from last week while friction signals increased slightly. This may indicate partners need renewed outreach.`;
    }
    case 'activation_delay': {
      const days = signal.source_summary?.days_since_created ?? 7;
      return `Onboarding has been waiting${location} for about ${days} days. A gentle check-in might help them find their next step.`;
    }
    case 'volunteer_dropoff': {
      const counts = (signal.source_summary?.week_counts as number[]) || [];
      return `Volunteer activity has ${adverb} decreased${location} over the past three weeks${counts.length === 3 ? ` (${counts[2]} → ${counts[1]} → ${counts[0]} shifts)` : ''}. This might be seasonal, or the team may benefit from encouragement.`;
    }
    case 'migration_fragility': {
      const fails = signal.source_summary?.failure_count_24h ?? 0;
      return `Migration runs${location} encountered ${fails} issues in the past day. The data pathway may need a careful review.`;
    }
    case 'expansion_ready': {
      const score = signal.source_summary?.expansion_score ?? 0;
      return `Expansion signals are ${adverb} accumulating${location} with a momentum score of ${score}. This community may be ready for the next chapter.`;
    }
    case 'narrative_surge': {
      const spike = signal.source_summary?.spike_pct ?? 0;
      return `Story activity surged ${adverb}${location} — up about ${spike}% from last week. Something meaningful may be unfolding.`;
    }
    default:
      return `${label}${location} — something is ${adverb} shifting. Worth a quiet look.`;
  }
}

export function buildLumenSummary(signals: LumenSignalRow[]): string {
  if (signals.length === 0) return 'All is quiet across the network. No emerging patterns this week.';
  const count = signals.length;
  const highCount = signals.filter(s => s.severity === 'high').length;
  const types = [...new Set(signals.map(s => typeLabels[s.signal_type] || s.signal_type))];

  let summary = `${count} early signal${count !== 1 ? 's' : ''} detected this week`;
  if (highCount > 0) summary += ` — ${highCount} worth closer attention`;
  summary += '. ';
  summary += types.slice(0, 3).join(', ');
  if (types.length > 3) summary += `, and ${types.length - 3} more`;
  summary += '.';
  return summary;
}
