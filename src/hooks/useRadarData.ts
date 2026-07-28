import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, subDays } from 'date-fns';

export interface RadarOpportunity {
  id: string;
  organization: string;
  stage: string;
  status: string;
  metro_id: string | null;
  metroName: string | null;
  next_action_due: string | null;
  next_step: string | null;
  last_contact_date: string | null;
  updated_at: string;
  // Computed
  urgencyScore: number;
  urgencyLabel: 'critical' | 'high' | 'medium' | 'low';
  reasons: string[];
  signalCount: number;
  latestSignalAt: string | null;
  daysOverdue: number | null;
  daysSinceContact: number | null;
}

export interface RadarSignal {
  id: string;
  opportunity_id: string | null;
  organization: string | null;
  signal_type: string;
  signal_value: string | null;
  confidence: number | null;
  detected_at: string;
  source_url: string | null;
}

export interface RadarMetroHot {
  metro_id: string;
  metroName: string;
  lat: number | null;
  lng: number | null;
  hotOpportunityCount: number;
  totalSignals: number;
  topOrg: string | null;
}

export function useRadarData() {
  return useQuery({
    queryKey: ['radar-data'],
    queryFn: async () => {
      const today = new Date();

      // Fetch active opportunities with metro info
      const { data: opps, error: oppErr } = await supabase
        .from('opportunities')
        .select('id, organization, stage, status, metro_id, next_action_due, next_step, last_contact_date, updated_at, metros(metro)')
        .eq('status', 'Active')
        .not('stage', 'in', '("Stable Producer","Closed - Not a Fit")')
        .order('updated_at', { ascending: true })
        .limit(200);

      if (oppErr) throw oppErr;

      // Fetch recent signals (last 30 days)
      const thirtyDaysAgo = subDays(today, 30).toISOString();
      const { data: signals, error: sigErr } = await supabase
        .from('opportunity_signals')
        .select('id, opportunity_id, signal_type, signal_value, confidence, detected_at, source_url')
        .gte('detected_at', thirtyDaysAgo)
        .order('detected_at', { ascending: false })
        .limit(500);

      if (sigErr) throw sigErr;

      // Build signal counts per opportunity
      const signalsByOpp = new Map<string, { count: number; latestAt: string }>();
      for (const sig of signals || []) {
        if (!sig.opportunity_id) continue;
        const existing = signalsByOpp.get(sig.opportunity_id);
        if (existing) {
          existing.count++;
          if (sig.detected_at > existing.latestAt) existing.latestAt = sig.detected_at;
        } else {
          signalsByOpp.set(sig.opportunity_id, { count: 1, latestAt: sig.detected_at });
        }
      }

      // Score opportunities
      const scored: RadarOpportunity[] = (opps || []).map(opp => {
        const reasons: string[] = [];
        let score = 0;

        // Overdue next action
        const daysOverdue = opp.next_action_due
          ? differenceInDays(today, parseISO(opp.next_action_due))
          : null;
        if (daysOverdue !== null && daysOverdue > 0) {
          score += Math.min(daysOverdue * 2, 40);
          reasons.push(`Next action ${daysOverdue}d overdue`);
        }

        // Stale contact
        const daysSinceContact = opp.last_contact_date
          ? differenceInDays(today, parseISO(opp.last_contact_date))
          : null;
        if (daysSinceContact !== null && daysSinceContact > 14) {
          score += Math.min(daysSinceContact, 30);
          reasons.push(`No contact in ${daysSinceContact}d`);
        }

        // Signal activity bonus (positive — signals mean something is happening)
        const sigData = signalsByOpp.get(opp.id);
        const sigCount = sigData?.count ?? 0;
        if (sigCount > 0) {
          score += sigCount * 5;
          reasons.push(`${sigCount} recent signal(s)`);
        }

        // Stage velocity — early stages with no movement get penalty
        const earlyStages = ['Target Identified', 'Contacted'];
        if (earlyStages.includes(opp.stage) && daysSinceContact && daysSinceContact > 21) {
          score += 15;
          reasons.push('Early stage stalling');
        }

        // Mid-stage with signals = high priority
        const midStages = ['Discovery Scheduled', 'Discovery Held', 'Proposal Sent', 'Agreement Pending'];
        if (midStages.includes(opp.stage) && sigCount > 0) {
          score += 10;
          reasons.push('Active signals at mid-stage');
        }

        const urgencyLabel: RadarOpportunity['urgencyLabel'] =
          score >= 50 ? 'critical' :
          score >= 30 ? 'high' :
          score >= 15 ? 'medium' : 'low';

        return {
          id: opp.id,
          organization: opp.organization,
          stage: opp.stage,
          status: opp.status,
          metro_id: opp.metro_id,
          metroName: (opp.metros as any)?.metro || null,
          next_action_due: opp.next_action_due,
          next_step: opp.next_step,
          last_contact_date: opp.last_contact_date,
          updated_at: opp.updated_at,
          urgencyScore: score,
          urgencyLabel,
          reasons,
          signalCount: sigCount,
          latestSignalAt: sigData?.latestAt ?? null,
          daysOverdue: daysOverdue !== null && daysOverdue > 0 ? daysOverdue : null,
          daysSinceContact,
        };
      });

      // Sort by urgency score desc
      scored.sort((a, b) => b.urgencyScore - a.urgencyScore);

      // Recent signals feed with org names
      const oppIdToOrg = new Map((opps || []).map(o => [o.id, o.organization]));
      const signalFeed: RadarSignal[] = (signals || []).slice(0, 30).map(s => ({
        ...s,
        organization: s.opportunity_id ? oppIdToOrg.get(s.opportunity_id) ?? null : null,
      }));

      // Metro hotspots
      const metroMap = new Map<string, RadarMetroHot>();
      for (const opp of scored) {
        if (!opp.metro_id || opp.urgencyScore < 15) continue;
        const existing = metroMap.get(opp.metro_id);
        if (existing) {
          existing.hotOpportunityCount++;
          existing.totalSignals += opp.signalCount;
          if (!existing.topOrg && opp.urgencyScore >= 30) existing.topOrg = opp.organization;
        } else {
          metroMap.set(opp.metro_id, {
            metro_id: opp.metro_id,
            metroName: opp.metroName || '',
            lat: null,
            lng: null,
            hotOpportunityCount: 1,
            totalSignals: opp.signalCount,
            topOrg: opp.urgencyScore >= 30 ? opp.organization : null,
          });
        }
      }

      return {
        opportunities: scored.filter(o => o.urgencyScore > 0),
        signalFeed,
        metroHotspots: Array.from(metroMap.values()),
        stats: {
          critical: scored.filter(o => o.urgencyLabel === 'critical').length,
          high: scored.filter(o => o.urgencyLabel === 'high').length,
          medium: scored.filter(o => o.urgencyLabel === 'medium').length,
          withSignals: scored.filter(o => o.signalCount > 0).length,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
