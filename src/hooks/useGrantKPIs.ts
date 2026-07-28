import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GrantStage, FunderType, GrantStatus } from './useGrants';

export interface GrantKPIs {
  activeGrants: number;
  grantsInPipeline: number;
  totalAmountRequested: number;
  totalAmountAwarded: number;
  grantsSupportingAnchors: number;
  averageStarRating: number;
}

export interface GrantsByStage {
  stage: GrantStage;
  count: number;
  color: string;
}

export interface GrantsByFunderType {
  funder_type: FunderType;
  count: number;
  amount: number;
  color: string;
}

export interface GrantsByMetro {
  metro: string;
  metro_id: string;
  count: number;
  amount_awarded: number;
}

const STAGE_COLORS: Record<GrantStage, string> = {
  'Researching': 'hsl(280, 60%, 55%)',
  'Eligible': 'hsl(199, 89%, 48%)',
  'Cultivating': 'hsl(217, 91%, 50%)',
  'LOI Submitted': 'hsl(38, 92%, 50%)',
  'Full Proposal Submitted': 'hsl(25, 95%, 53%)',
  'Awarded': 'hsl(142, 71%, 45%)',
  'Declined': 'hsl(0, 70%, 55%)',
  'Closed': 'hsl(220, 10%, 50%)',
};

const FUNDER_TYPE_COLORS: Record<FunderType, string> = {
  'Foundation': 'hsl(262, 83%, 58%)',
  'Government - Federal': 'hsl(199, 89%, 48%)',
  'Government - State': 'hsl(217, 91%, 60%)',
  'Government - Local': 'hsl(38, 92%, 50%)',
  'Corporate': 'hsl(142, 71%, 45%)',
  'Other': 'hsl(220, 10%, 50%)',
};

export function useGrantKPIs(metroId?: string | null) {
  return useQuery({
    queryKey: ['grant-kpis', metroId],
    queryFn: async (): Promise<GrantKPIs> => {
      let query = supabase.from('grants').select('*');
      
      if (metroId) {
        query = query.eq('metro_id', metroId);
      }
      
      const { data: grants, error } = await query;
      
      if (error) throw error;
      
      const activeGrants = (grants || []).filter(g => g.status === 'Active').length;
      const pipelineStages: GrantStage[] = ['Researching', 'Eligible', 'Cultivating', 'LOI Submitted', 'Full Proposal Submitted'];
      const grantsInPipeline = (grants || []).filter(g => pipelineStages.includes(g.stage as GrantStage)).length;
      const totalAmountRequested = (grants || []).reduce((sum, g) => sum + (Number(g.amount_requested) || 0), 0);
      const totalAmountAwarded = (grants || []).reduce((sum, g) => sum + (Number(g.amount_awarded) || 0), 0);
      const grantsSupportingAnchors = (grants || []).filter(g => g.opportunity_id).length;
      
      const ratingsSum = (grants || []).reduce((sum, g) => sum + (g.star_rating || 0), 0);
      const averageStarRating = grants?.length ? ratingsSum / grants.length : 0;
      
      return {
        activeGrants,
        grantsInPipeline,
        totalAmountRequested,
        totalAmountAwarded,
        grantsSupportingAnchors,
        averageStarRating,
      };
    },
  });
}

export function useGrantsByStage(metroId?: string | null) {
  return useQuery({
    queryKey: ['grants-by-stage', metroId],
    queryFn: async (): Promise<GrantsByStage[]> => {
      let query = supabase.from('grants').select('stage');
      
      if (metroId) {
        query = query.eq('metro_id', metroId);
      }
      
      const { data: grants, error } = await query;
      
      if (error) throw error;
      
      const stages: GrantStage[] = [
        'Researching', 'Eligible', 'Cultivating', 'LOI Submitted',
        'Full Proposal Submitted', 'Awarded', 'Declined', 'Closed'
      ];
      
      return stages.map(stage => ({
        stage,
        count: (grants || []).filter(g => g.stage === stage).length,
        color: STAGE_COLORS[stage],
      }));
    },
  });
}

export function useGrantsByFunderType(metroId?: string | null) {
  return useQuery({
    queryKey: ['grants-by-funder-type', metroId],
    queryFn: async (): Promise<GrantsByFunderType[]> => {
      let query = supabase.from('grants').select('funder_type, amount_awarded');
      
      if (metroId) {
        query = query.eq('metro_id', metroId);
      }
      
      const { data: grants, error } = await query;
      
      if (error) throw error;
      
      const funderTypes: FunderType[] = [
        'Foundation', 'Government - Federal', 'Government - State',
        'Government - Local', 'Corporate', 'Other'
      ];
      
      return funderTypes.map(funderType => {
        const matching = (grants || []).filter(g => g.funder_type === funderType);
        return {
          funder_type: funderType,
          count: matching.length,
          amount: matching.reduce((sum, g) => sum + (Number(g.amount_awarded) || 0), 0),
          color: FUNDER_TYPE_COLORS[funderType],
        };
      }).filter(ft => ft.count > 0);
    },
  });
}

export function useGrantsByMetro() {
  return useQuery({
    queryKey: ['grants-by-metro'],
    queryFn: async (): Promise<GrantsByMetro[]> => {
      const { data: grants, error } = await supabase
        .from('grants')
        .select('metro_id, amount_awarded, metros(metro)')
        .not('metro_id', 'is', null);
      
      if (error) throw error;
      
      // Group by metro
      const metroMap = new Map<string, { metro: string; count: number; amount: number }>();
      
      for (const grant of grants || []) {
        if (!grant.metro_id) continue;
        const metroName = (grant.metros as { metro: string } | null)?.metro || 'Unknown';
        const existing = metroMap.get(grant.metro_id);
        if (existing) {
          existing.count++;
          existing.amount += Number(grant.amount_awarded) || 0;
        } else {
          metroMap.set(grant.metro_id, {
            metro: metroName,
            count: 1,
            amount: Number(grant.amount_awarded) || 0,
          });
        }
      }
      
      return Array.from(metroMap.entries())
        .map(([metro_id, data]) => ({
          metro_id,
          metro: data.metro,
          count: data.count,
          amount_awarded: data.amount,
        }))
        .sort((a, b) => b.amount_awarded - a.amount_awarded);
    },
  });
}

export function useUpcomingSubmissions(days: number = 60) {
  return useQuery({
    queryKey: ['upcoming-submissions', days],
    queryFn: async () => {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);
      
      const { data, error } = await supabase
        .from('grants')
        .select('*, metros(metro)')
        .in('stage', ['Researching', 'Eligible', 'Cultivating', 'LOI Submitted'])
        .eq('status', 'Active')
        .order('stage_entry_date', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useGrantsWithReportingDue() {
  return useQuery({
    queryKey: ['grants-reporting-due'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grants')
        .select('*, metros(metro)')
        .eq('reporting_required', true)
        .eq('status', 'Active')
        .eq('stage', 'Awarded')
        .order('grant_term_end', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });
}
