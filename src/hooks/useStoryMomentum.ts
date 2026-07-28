import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeMetro } from '@/hooks/useHomeMetro';

export type StoryDensityLabel = 'quiet' | 'active' | 'growing' | 'vibrant';

export interface StorySourceCounts {
  reflections_count: number;
  email_touch_count: number;
  campaign_touch_count: number;
  local_pulse_event_count: number;
  partner_activity_count: number;
  metro_signal_count: number;
}

export interface MetroStoryData {
  metroId: string;
  sources: StorySourceCounts;
  densityLabel: StoryDensityLabel;
  isHomeMetro: boolean;
  latestNarrativeHeadline: string | null;
  topPartners: { orgName: string; lastTouch: string }[];
}

// Extracted thresholds — prevents hard-coded logic drift
export const DENSITY_THRESHOLDS = {
  vibrant: { sources: 4, total: 10 },
  growing: { sources: 3, total: 6 },
  active: { total: 2 },
} as const;

export function computeDensity(sources: StorySourceCounts): StoryDensityLabel {
  const total = (sources.reflections_count ?? 0)
    + (sources.email_touch_count ?? 0)
    + (sources.campaign_touch_count ?? 0)
    + (sources.local_pulse_event_count ?? 0)
    + (sources.partner_activity_count ?? 0)
    + (sources.metro_signal_count ?? 0);

  const activeSources = [
    sources.reflections_count,
    sources.email_touch_count,
    sources.campaign_touch_count,
    sources.local_pulse_event_count,
    sources.partner_activity_count,
    sources.metro_signal_count,
  ].filter(v => (v ?? 0) > 0).length;

  if (activeSources >= DENSITY_THRESHOLDS.vibrant.sources && total >= DENSITY_THRESHOLDS.vibrant.total) return 'vibrant';
  if (activeSources >= DENSITY_THRESHOLDS.growing.sources || total >= DENSITY_THRESHOLDS.growing.total) return 'growing';
  if (total >= DENSITY_THRESHOLDS.active.total) return 'active';
  return 'quiet';
}

/**
 * Fetches story-layer metadata for all metros.
 * Uses lightweight COUNT queries — no heavy joins or LLM calls.
 * Lazy-loaded after heat map renders.
 *
 * PRIVACY: Story layer only uses counts + org names.
 * Never includes reflection text, journal note_text, or email bodies.
 */
export function useStoryMomentum(metroIds: string[]) {
  const { user } = useAuth();
  const { data: homeMetroId } = useHomeMetro();

  return useQuery({
    queryKey: ['story-momentum', metroIds.sort().join(','), user?.id],
    queryFn: async (): Promise<Record<string, MetroStoryData>> => {
      if (!metroIds.length) return {};
      if (!user?.id) return {};

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      // PRIVACY: Only select id + metro_id — never reflection body text
      // Each query kept to ≤3 chained filters to avoid TS2589
      const reflectionsQuery = supabase
        .from('journal_entries')
        .select('id, metro_id')
        .in('metro_id', metroIds)
        .gte('created_at', cutoff)
        .limit(200);

      const activitiesQuery = supabase
        .from('activities')
        .select('id, metro_id')
        .in('metro_id', metroIds)
        .gte('activity_date_time', cutoff)
        .limit(500);

      // PRIVACY: Only select id + opportunity_id — never email body or HTML
      const campaignQuery = supabase
        .from('email_campaign_audience')
        .select('id, opportunity_id')
        .eq('status', 'sent')
        .gte('sent_at', cutoff)
        .limit(500);

      // Local Pulse: uses is_local_pulse = true on events table
      const pulseQuery = supabase
        .from('events')
        .select('id, metro_id, is_local_pulse')
        .in('metro_id', metroIds)
        .eq('is_local_pulse', true);

      const signalsQuery = supabase
        .from('opportunity_signals')
        .select('id, opportunity_id')
        .gte('created_at', cutoff);

      const narrativesQuery = supabase
        .from('metro_narratives')
        .select('metro_id, narrative_json')
        .in('metro_id', metroIds)
        .order('created_at', { ascending: false });

      // PRIVACY: Only select id, organization, metro_id, last_contact_date — no PII
      const partnersQuery = supabase
        .from('opportunities')
        .select('id, organization, metro_id, last_contact_date')
        .in('metro_id', metroIds)
        .order('last_contact_date', { ascending: false })
        .limit(100);

      const [
        reflectionsRes,
        activitiesRes,
        campaignAudienceRes,
        localPulseRes,
        signalsRes,
        narrativesRes,
        partnersRes,
      ] = await Promise.all([
        reflectionsQuery,
        activitiesQuery,
        campaignQuery,
        pulseQuery,
        signalsQuery,
        narrativesQuery,
        partnersQuery,
      ]);

      // Build per-metro counts
      const result: Record<string, MetroStoryData> = {};

      for (const metroId of metroIds) {
        const reflections = (reflectionsRes.data || []).filter(r => r.metro_id === metroId).length;
        const emailTouches = (activitiesRes.data || []).filter(a => a.metro_id === metroId).length;
        const localPulse = (localPulseRes.data || []).filter(e => e.metro_id === metroId).length;

        // Campaign touches — count audience rows linked to opps in this metro
        const metroOppIds = new Set(
          (partnersRes.data || [])
            .filter(o => o.metro_id === metroId)
            .map(o => o.id)
        );
        const campaignTouches = (campaignAudienceRes.data || [])
          .filter(a => a.opportunity_id && metroOppIds.has(a.opportunity_id)).length;

        // Signals count
        const metroSignals = (signalsRes.data || [])
          .filter(s => s.opportunity_id && metroOppIds.has(s.opportunity_id)).length;

        // Partner activity count (distinct orgs with recent contact)
        const recentPartners = (partnersRes.data || [])
          .filter(o => o.metro_id === metroId && o.last_contact_date && o.last_contact_date >= cutoff.split('T')[0]);

        const sources: StorySourceCounts = {
          reflections_count: reflections ?? 0,
          email_touch_count: emailTouches ?? 0,
          campaign_touch_count: campaignTouches ?? 0,
          local_pulse_event_count: localPulse ?? 0,
          partner_activity_count: recentPartners.length ?? 0,
          metro_signal_count: metroSignals ?? 0,
        };

        // Latest narrative headline — guard shape
        const narrative = (narrativesRes.data || []).find(n => n.metro_id === metroId);
        let headline: string | null = null;
        try {
          headline = (narrative?.narrative_json as any)?.headline ?? null;
          if (typeof headline !== 'string') headline = null;
        } catch {
          headline = null;
        }

        // Top partners — org name + last touch only, no PII
        const topPartners = recentPartners
          .slice(0, 3)
          .map(o => ({
            orgName: o.organization ?? 'Unknown',
            lastTouch: o.last_contact_date ?? '',
          }));

        result[metroId] = {
          metroId,
          sources,
          densityLabel: computeDensity(sources),
          isHomeMetro: metroId === homeMetroId,
          latestNarrativeHeadline: headline,
          topPartners,
        };
      }

      return result;
    },
    enabled: !!user?.id && metroIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
