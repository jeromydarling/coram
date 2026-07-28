/**
 * useRelationshipDrift — Surfaces relationships that may need gentle attention.
 *
 * WHAT: Computes days-since-last-activity for each opportunity in the tenant.
 * WHERE: Testimonium Drift Detection tab.
 * WHY: Helps stewards notice which relationships have gone quiet —
 *      not as an alarm, but as a gentle invitation to reconnect.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { differenceInDays } from 'date-fns';

export type DriftStatus = 'present' | 'quiet' | 'drifting' | 'distant';

export interface RelationshipDriftItem {
  opportunityId: string;
  name: string;
  stage: string | null;
  lastActivityDate: string | null;
  lastActivityType: string | null;
  daysSinceContact: number;
  driftStatus: DriftStatus;
  contactCount: number;
}

function classifyDrift(days: number): DriftStatus {
  if (days <= 14) return 'present';
  if (days <= 30) return 'quiet';
  if (days <= 60) return 'drifting';
  return 'distant';
}

export function useRelationshipDrift() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['relationship-drift', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RelationshipDriftItem[]> => {
      // Fetch opportunities with their latest activity
      const { data: opps, error: oppError } = await supabase
        .from('opportunities')
        .select('id, organization, stage, tenant_id, last_activity_at')
        .eq('tenant_id', tenant!.id)
        .is('deleted_at', null)
        .order('organization');

      if (oppError) throw oppError;
      if (!opps?.length) return [];

      const oppIds = opps.map(o => o.id);

      // Fetch latest activity per opportunity — single query
      const { data: activities, error: actError } = await supabase
        .from('activities')
        .select('opportunity_id, activity_date_time, activity_type')
        .in('opportunity_id', oppIds)
        .eq('tenant_id', tenant!.id)
        .order('activity_date_time', { ascending: false });

      if (actError) throw actError;

      // Build latest-activity map
      const latestMap = new Map<string, { date: string; type: string; count: number }>();
      for (const a of activities || []) {
        if (!a.opportunity_id) continue;
        const existing = latestMap.get(a.opportunity_id);
        if (existing) {
          existing.count++;
        } else {
          latestMap.set(a.opportunity_id, {
            date: a.activity_date_time,
            type: a.activity_type,
            count: 1,
          });
        }
      }

      const now = new Date();
      return opps.map(opp => {
        const latest = latestMap.get(opp.id);
        const lastDate = latest?.date ?? opp.last_activity_at;
        const daysSince = lastDate
          ? differenceInDays(now, new Date(lastDate))
          : 999;
        return {
          opportunityId: opp.id,
          name: opp.organization ?? 'Unnamed',
          stage: opp.stage,
          lastActivityDate: lastDate ?? null,
          lastActivityType: latest?.type ?? null,
          daysSinceContact: daysSince,
          driftStatus: classifyDrift(daysSince),
          contactCount: latest?.count ?? 0,
        };
      })
        .sort((a, b) => b.daysSinceContact - a.daysSinceContact);
    },
  });
}
