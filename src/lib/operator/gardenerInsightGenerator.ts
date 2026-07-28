/**
 * gardenerInsightGenerator — Transforms behavioral signals into calm Gardener insights.
 *
 * WHAT: Queries app_event_stream (non-error only) and generates deduplicated insight cards.
 * WHERE: Called by the Discovery Insights page or a scheduled background process.
 * WHY: Gardeners receive human-language guidance about what visitors and users find meaningful.
 *
 * PRIVACY INVARIANTS:
 * - Always filters is_error = false
 * - Never surfaces PII
 * - Dedupes by type + topic + month
 */

export interface InsightCandidate {
  type: 'essay_ready' | 'discovery_interest' | 'adoption_friction' | 'onboarding_dropoff' | 'integration_interest' | 'familia_kinship' | 'resource_stewardship' | 'familia_stewardship';
  severity: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  suggested_next_steps: { label: string; url?: string }[];
  related_links: string[];
  dedupe_key: string;
}

/** Build a stable dedupe key. */
export function buildDedupeKey(
  type: string,
  topic: string,
  monthKey: string,
  pagePath?: string
): string {
  return [type, topic, monthKey, pagePath || ''].join(':');
}

/** Current month key for deduping. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Generate an "essay ready" insight when a draft transitions to ready_for_review.
 */
export function generateEssayReadyInsight(essayTitle: string, essaySlug: string): InsightCandidate {
  return {
    type: 'essay_ready',
    severity: 'low',
    title: 'A draft is ready for your touch',
    body: `"${essayTitle}" has been prepared by NRI and is waiting for your review. Take a moment when you're ready.`,
    suggested_next_steps: [
      { label: 'Review draft', url: `/operator/nexus/content` },
    ],
    related_links: [`/library/${essaySlug}`],
    dedupe_key: buildDedupeKey('essay_ready', essaySlug, currentMonthKey()),
  };
}

/**
 * Generate a "discovery interest" insight from page visit patterns.
 */
export function generateDiscoveryInterest(
  featureKey: string,
  featureLabel: string,
  visitCount: number,
  relatedFeature?: string
): InsightCandidate {
  const bodyParts = [
    `Visitors seem drawn to "${featureLabel}" — ${visitCount} people explored it recently.`,
  ];
  if (relatedFeature) {
    bodyParts.push(`Many also visited ${relatedFeature}. Consider strengthening the connection between these surfaces.`);
  }

  return {
    type: 'discovery_interest',
    severity: visitCount > 20 ? 'medium' : 'low',
    title: `Curiosity around ${featureLabel}`,
    body: bodyParts.join(' '),
    suggested_next_steps: [
      { label: 'View feature page', url: `/features` },
    ],
    related_links: [],
    dedupe_key: buildDedupeKey('discovery_interest', featureKey, currentMonthKey()),
  };
}

/**
 * Generate an "adoption friction" insight from repeated navigation patterns.
 * Only non-error behavioral signals qualify.
 */
export function generateAdoptionFriction(
  pagePath: string,
  pattern: string,
  suggestion: string
): InsightCandidate {
  return {
    type: 'adoption_friction',
    severity: 'medium',
    title: 'A gentle pattern worth noticing',
    body: `${pattern} Consider: ${suggestion}`,
    suggested_next_steps: [
      { label: 'Review page', url: pagePath },
    ],
    related_links: [],
    dedupe_key: buildDedupeKey('adoption_friction', pagePath, currentMonthKey()),
  };
}

/**
 * Generate a "familia kinship detected" insight when NRI notices possible organizational kinship.
 */
export function generateFamiliaKinshipInsight(
  metroName: string,
  candidateCount: number
): InsightCandidate {
  return {
    type: 'familia_kinship',
    severity: candidateCount >= 3 ? 'medium' : 'low',
    title: 'Emerging household signals',
    body: `NRI noticed ${candidateCount} communit${candidateCount === 1 ? 'y' : 'ies'} in ${metroName} sharing mission signals. This may represent an emerging household — if they want it.`,
    suggested_next_steps: [
      { label: 'View suggestions', url: '/operator/nexus/insights' },
    ],
    related_links: [],
    dedupe_key: buildDedupeKey('familia_kinship', metroName, currentMonthKey()),
  };
}

/**
 * Generate a "resource stewardship" insight when NRI notices care patterns or supply shifts.
 */
export function generateResourceStewardshipInsight(
  tenantName: string,
  signalType: 'care_pattern_emerging' | 'supply_pressure_warning' | 'community_need_shift',
  detail: string
): InsightCandidate {
  const titles: Record<string, string> = {
    care_pattern_emerging: 'A pattern of care is emerging',
    supply_pressure_warning: 'Resource attention may be needed',
    community_need_shift: 'Community needs are shifting',
  };
  return {
    type: 'resource_stewardship',
    severity: signalType === 'supply_pressure_warning' ? 'medium' : 'low',
    title: titles[signalType] || 'Stewardship signal',
    body: detail,
    suggested_next_steps: [
      { label: 'Review shared resources', url: '/provisions' },
    ],
    related_links: [],
    dedupe_key: buildDedupeKey('resource_stewardship', `${tenantName}:${signalType}`, currentMonthKey()),
  };
}

/**
 * Generate a "familia stewardship" insight when NRI notices collective care patterns.
 */
export function generateFamiliaStewardshipInsight(
  familiaName: string,
  signalType: 'shared_resource_pattern' | 'regional_need_shift' | 'collective_response_emerging',
  detail: string
): InsightCandidate {
  const titles: Record<string, string> = {
    shared_resource_pattern: 'A shared rhythm of care is emerging',
    regional_need_shift: 'Community needs are shifting across the household',
    collective_response_emerging: 'A collective response is forming',
  };
  return {
    type: 'familia_stewardship',
    severity: signalType === 'regional_need_shift' ? 'medium' : 'low',
    title: titles[signalType] || 'Shared stewardship signal',
    body: detail,
    suggested_next_steps: [
      { label: 'Review shared patterns', url: '/provisions' },
    ],
    related_links: [],
    dedupe_key: buildDedupeKey('familia_stewardship', `${familiaName}:${signalType}`, currentMonthKey()),
  };
}

