import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type DriftLabel = 'steady' | 'shifting' | 'changing';

export interface DriftTopicEntry {
  topic: string;
  delta: number;
  evidence_count: number;
}

export interface MetroDriftData {
  id: string;
  metroId: string;
  driftScore: number;
  driftLabel: DriftLabel;
  emergingTopics: DriftTopicEntry[];
  fadingTopics: DriftTopicEntry[];
  acceleratingTopics: DriftTopicEntry[];
  stableThemes: DriftTopicEntry[];
  divergence: Record<string, Record<string, number>>;
  summaryMd: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

function toDriftLabel(score: number): DriftLabel {
  if (score <= 20) return 'steady';
  if (score <= 50) return 'shifting';
  return 'changing';
}

function parseDriftRow(data: Record<string, unknown>): MetroDriftData {
  return {
    id: data.id as string,
    metroId: data.metro_id as string,
    driftScore: data.drift_score as number,
    driftLabel: toDriftLabel(data.drift_score as number),
    emergingTopics: (Array.isArray(data.emerging_topics) ? data.emerging_topics : []) as DriftTopicEntry[],
    fadingTopics: (Array.isArray(data.fading_topics) ? data.fading_topics : []) as DriftTopicEntry[],
    acceleratingTopics: (Array.isArray(data.accelerating_topics) ? data.accelerating_topics : []) as DriftTopicEntry[],
    stableThemes: (Array.isArray(data.stable_themes) ? data.stable_themes : []) as DriftTopicEntry[],
    divergence: (typeof data.divergence === 'object' && data.divergence !== null && !Array.isArray(data.divergence)
      ? data.divergence : {}) as Record<string, Record<string, number>>,
    summaryMd: (data.summary_md as string) ?? '',
    periodStart: data.period_start as string,
    periodEnd: data.period_end as string,
    createdAt: data.created_at as string,
  };
}

/**
 * Fetches the latest narrative drift for a given metro.
 * PRIVACY: Only reads drift metadata — no reflection text or email bodies.
 */
export function useMetroDrift(metroId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['metro-drift', metroId, user?.id],
    queryFn: async (): Promise<MetroDriftData | null> => {
      if (!metroId) return null;

      const { data, error } = await supabase
        .from('metro_narrative_drifts')
        .select('id, metro_id, drift_score, emerging_topics, fading_topics, accelerating_topics, stable_themes, divergence, summary_md, period_start, period_end, created_at')
        .eq('metro_id', metroId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return parseDriftRow(data as unknown as Record<string, unknown>);
    },
    enabled: !!user?.id && !!metroId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetches drift scores for multiple metros (for heat map overlay).
 */
export function useMetroDriftScores(metroIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['metro-drift-scores', metroIds.sort().join(','), user?.id],
    queryFn: async (): Promise<Record<string, { driftScore: number; driftLabel: DriftLabel; emergingTopics: string[] }>> => {
      if (!metroIds.length) return {};

      const { data, error } = await supabase
        .from('metro_narrative_drifts')
        .select('metro_id, drift_score, emerging_topics, created_at')
        .in('metro_id', metroIds)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error || !data) return {};

      const result: Record<string, { driftScore: number; driftLabel: DriftLabel; emergingTopics: string[] }> = {};
      for (const row of data) {
        if (result[row.metro_id]) continue;
        const rawTopics = Array.isArray(row.emerging_topics) ? row.emerging_topics : [];
        const topics = (rawTopics as Array<{ topic?: string }>)
          .slice(0, 2)
          .map(t => ((t?.topic ?? '') as string).replace(/-/g, ' '));
        result[row.metro_id] = {
          driftScore: row.drift_score,
          driftLabel: toDriftLabel(row.drift_score),
          emergingTopics: topics,
        };
      }
      return result;
    },
    enabled: !!user?.id && metroIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetches drift history for a metro.
 */
export function useMetroDriftHistory(metroId: string | null, limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['metro-drift-history', metroId, limit, user?.id],
    queryFn: async (): Promise<MetroDriftData[]> => {
      if (!metroId) return [];

      const { data, error } = await supabase
        .from('metro_narrative_drifts')
        .select('id, metro_id, drift_score, emerging_topics, fading_topics, accelerating_topics, stable_themes, divergence, summary_md, period_start, period_end, created_at')
        .eq('metro_id', metroId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data.map(d => parseDriftRow(d as unknown as Record<string, unknown>));
    },
    enabled: !!user?.id && !!metroId,
    staleTime: 1000 * 60 * 5,
  });
}
