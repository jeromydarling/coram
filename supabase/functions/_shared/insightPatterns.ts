/**
 * getEffectiveInsightPatterns — Read-only, deterministic pattern extraction
 * 
 * Returns top insight categories and action types by success rate.
 * No AI, no side effects, purely derived from org_action_outcomes.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface InsightPattern {
  insight_type: string;
  total_outcomes: number;
  successful: number;
  unsuccessful: number;
  success_rate: number;
}

export interface ActionPattern {
  action_type: string;
  total_outcomes: number;
  successful: number;
  unsuccessful: number;
  success_rate: number;
}

export interface EffectivePatterns {
  top_insight_types: InsightPattern[];
  top_action_types: ActionPattern[];
}

export async function getEffectiveInsightPatterns(
  supabase: SupabaseClient,
  input: { org_id?: string },
): Promise<EffectivePatterns> {
  // Build query for insight-level patterns
  let insightQuery = supabase
    .from("org_insights")
    .select(`
      insight_type,
      org_recommended_actions!inner (
        action_type,
        org_action_outcomes!inner (
          outcome_type
        )
      )
    `);

  if (input.org_id) {
    insightQuery = insightQuery.eq("org_id", input.org_id);
  }

  const { data: insightData, error: insightErr } = await insightQuery;

  if (insightErr) {
    console.error("Pattern extraction error:", insightErr.message);
    return { top_insight_types: [], top_action_types: [] };
  }

  // Aggregate insight type patterns
  const insightMap = new Map<string, { total: number; successful: number; unsuccessful: number }>();
  const actionMap = new Map<string, { total: number; successful: number; unsuccessful: number }>();

  for (const insight of (insightData || [])) {
    const iType = insight.insight_type;
    if (!insightMap.has(iType)) {
      insightMap.set(iType, { total: 0, successful: 0, unsuccessful: 0 });
    }
    const iStats = insightMap.get(iType)!;

    const actions = Array.isArray(insight.org_recommended_actions)
      ? insight.org_recommended_actions
      : [insight.org_recommended_actions].filter(Boolean);

    for (const action of actions) {
      const aType = (action as Record<string, unknown>).action_type as string;
      if (!actionMap.has(aType)) {
        actionMap.set(aType, { total: 0, successful: 0, unsuccessful: 0 });
      }
      const aStats = actionMap.get(aType)!;

      const outcomes = Array.isArray((action as Record<string, unknown>).org_action_outcomes)
        ? (action as Record<string, unknown>).org_action_outcomes as Array<{ outcome_type: string }>
        : [(action as Record<string, unknown>).org_action_outcomes].filter(Boolean) as Array<{ outcome_type: string }>;

      for (const outcome of outcomes) {
        iStats.total++;
        aStats.total++;
        if (outcome.outcome_type === "successful") {
          iStats.successful++;
          aStats.successful++;
        } else if (outcome.outcome_type === "unsuccessful") {
          iStats.unsuccessful++;
          aStats.unsuccessful++;
        }
      }
    }
  }

  const toPattern = (
    map: Map<string, { total: number; successful: number; unsuccessful: number }>,
    keyName: string,
  ) => {
    return [...map.entries()]
      .map(([key, stats]) => ({
        [keyName]: key,
        total_outcomes: stats.total,
        successful: stats.successful,
        unsuccessful: stats.unsuccessful,
        success_rate:
          stats.successful + stats.unsuccessful > 0
            ? Math.round((stats.successful / (stats.successful + stats.unsuccessful)) * 100)
            : 0,
      }))
      .sort((a, b) => b.success_rate - a.success_rate || b.total_outcomes - a.total_outcomes);
  };

  return {
    top_insight_types: toPattern(insightMap, "insight_type") as unknown as InsightPattern[],
    top_action_types: toPattern(actionMap, "action_type") as unknown as ActionPattern[],
  };
}
