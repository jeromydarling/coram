/**
 * Narrative Drift Computation Engine (browser-compatible)
 *
 * PRIVACY: Only operates on topic slugs and numeric counts.
 * Never processes reflection text, email bodies, or campaign HTML.
 */

// ── Slugify ──

export function slugifyTopic(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Types ──

export interface TopicCounts {
  [slug: string]: number;
}

export interface SourceMix {
  news?: number;
  reflections?: number;
  partners?: number;
  pulse_events?: number;
  [key: string]: number | undefined;
}

export interface DriftTopicEntry {
  topic: string;
  delta: number;
  evidence_count: number;
}

export interface DriftResult {
  drift_score: number;
  emerging_topics: DriftTopicEntry[];
  fading_topics: DriftTopicEntry[];
  accelerating_topics: DriftTopicEntry[];
  stable_themes: DriftTopicEntry[];
  divergence: Record<string, Record<string, number>>;
  summary_md: string;
}

// ── Constants ──

const EMERGING_THRESHOLD = 2;
const FADING_THRESHOLD = -2;
const ACCELERATING_THRESHOLD = 3;
const MAX_TOPICS_PER_SNAPSHOT = 30;

const WEIGHT_TOPIC_CHANGE = 0.5;
const WEIGHT_ACCELERATION = 0.3;
const WEIGHT_DIVERGENCE = 0.2;

// ── Normalize topic counts ──

export function normalizeTopicCounts(raw: Record<string, number>): TopicCounts {
  const entries = Object.entries(raw)
    .map(([k, v]) => [slugifyTopic(k), Math.max(0, v ?? 0)] as [string, number])
    .filter(([k]) => k.length > 0);

  const merged = new Map<string, number>();
  for (const [k, v] of entries) {
    merged.set(k, (merged.get(k) ?? 0) + v);
  }

  return Object.fromEntries(
    [...merged.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOPICS_PER_SNAPSHOT)
  );
}

// ── Compute drift ──

export function computeDrift(
  previous: { topic_counts: TopicCounts; signal_counts: TopicCounts; source_mix: SourceMix } | null,
  current: { topic_counts: TopicCounts; signal_counts: TopicCounts; source_mix: SourceMix },
): DriftResult {
  if (!previous) {
    return {
      drift_score: 0,
      emerging_topics: [],
      fading_topics: [],
      accelerating_topics: [],
      stable_themes: Object.entries(current.topic_counts)
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, delta: 0, evidence_count: count })),
      divergence: {},
      summary_md: "This is the first chapter we've recorded for this period.",
    };
  }

  const prevTopics = previous.topic_counts;
  const currTopics = current.topic_counts;
  const allTopics = new Set([...Object.keys(prevTopics), ...Object.keys(currTopics)]);

  const emerging: DriftTopicEntry[] = [];
  const fading: DriftTopicEntry[] = [];
  const accelerating: DriftTopicEntry[] = [];
  const stable: DriftTopicEntry[] = [];

  for (const topic of allTopics) {
    const prev = prevTopics[topic] ?? 0;
    const curr = currTopics[topic] ?? 0;
    const delta = curr - prev;

    if (prev === 0 && curr >= EMERGING_THRESHOLD) {
      emerging.push({ topic, delta, evidence_count: curr });
    } else if (curr === 0 && prev >= EMERGING_THRESHOLD) {
      fading.push({ topic, delta, evidence_count: prev });
    } else if (delta <= FADING_THRESHOLD) {
      fading.push({ topic, delta, evidence_count: curr });
    } else if (delta >= ACCELERATING_THRESHOLD) {
      accelerating.push({ topic, delta, evidence_count: curr });
    } else if (prev > 0 && curr > 0 && Math.abs(delta) <= 1) {
      stable.push({ topic, delta, evidence_count: curr });
    }
  }

  emerging.sort((a, b) => b.delta - a.delta);
  fading.sort((a, b) => a.delta - b.delta);
  accelerating.sort((a, b) => b.delta - a.delta);

  const divergence: Record<string, Record<string, number>> = {};
  const prevNews = previous.source_mix.news ?? 0;
  const currNews = current.source_mix.news ?? 0;
  const prevReflections = previous.source_mix.reflections ?? 0;
  const currReflections = current.source_mix.reflections ?? 0;
  const newsDelta = currNews - prevNews;
  const reflectionDelta = currReflections - prevReflections;
  if (Math.abs(newsDelta - reflectionDelta) > 1) {
    divergence['news_vs_reflections'] = {
      news_delta: newsDelta,
      reflections_delta: reflectionDelta,
    };
  }

  const prevTopN = Object.keys(prevTopics).slice(0, 10);
  const currTopN = new Set(Object.keys(currTopics).slice(0, 10));
  const topicChangeRate = prevTopN.length > 0
    ? prevTopN.filter(t => !currTopN.has(t)).length / prevTopN.length
    : 0;

  const accelerationMagnitude = accelerating.reduce((sum, a) => sum + Math.abs(a.delta), 0);
  const normalizedAccel = Math.min(accelerationMagnitude / 30, 1);

  const divergenceMagnitude = Object.values(divergence).reduce((sum, d) => {
    return sum + Object.values(d).reduce((s, v) => s + Math.abs(v), 0);
  }, 0);
  const normalizedDivergence = Math.min(divergenceMagnitude / 20, 1);

  const rawScore = (
    WEIGHT_TOPIC_CHANGE * topicChangeRate +
    WEIGHT_ACCELERATION * normalizedAccel +
    WEIGHT_DIVERGENCE * normalizedDivergence
  ) * 100;

  const drift_score = Math.round(Math.max(0, Math.min(100, rawScore)));

  const summaryParts: string[] = [];
  if (emerging.length > 0) {
    summaryParts.push(`New themes appearing: ${emerging.slice(0, 3).map(e => e.topic.replace(/-/g, ' ')).join(', ')}.`);
  }
  if (accelerating.length > 0) {
    summaryParts.push(`Gaining momentum: ${accelerating.slice(0, 2).map(a => a.topic.replace(/-/g, ' ')).join(', ')}.`);
  }
  if (fading.length > 0) {
    summaryParts.push(`Quieting down: ${fading.slice(0, 2).map(f => f.topic.replace(/-/g, ' ')).join(', ')}.`);
  }
  if (Object.keys(divergence).length > 0) {
    summaryParts.push('Community signals and personal reflections are telling different stories.');
  }
  if (summaryParts.length === 0) {
    summaryParts.push('The narrative remains steady — familiar themes continue to shape this metro.');
  }

  return {
    drift_score,
    emerging_topics: emerging.slice(0, 10),
    fading_topics: fading.slice(0, 10),
    accelerating_topics: accelerating.slice(0, 10),
    stable_themes: stable.slice(0, 10),
    divergence,
    summary_md: summaryParts.join(' '),
  };
}

export type DriftLabel = 'steady' | 'shifting' | 'changing';

export function driftScoreLabel(score: number): DriftLabel {
  if (score <= 20) return 'steady';
  if (score <= 50) return 'shifting';
  return 'changing';
}
