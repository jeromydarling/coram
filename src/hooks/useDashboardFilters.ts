import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  countActiveAnchors, 
  countAnchorsFormedInPeriod,
  computeMetroReadiness,
  calculateMedianCycleTime,
  computeProductionStatus
} from '@/lib/computations';
import type { DashboardKPIs, MetroWithReadiness } from './useDashboardKPIs';

export function useFilteredDashboardKPIs(metroId?: string | null) {
  return useQuery({
    queryKey: ['dashboard-kpis', metroId],
    queryFn: async () => {
      // Fetch all required data in parallel
      const [anchorsResult, pipelineResult, metrosResult] = await Promise.all([
        supabase.from('anchors').select('*'),
        supabase.from('anchor_pipeline').select('*'),
        supabase.from('metros').select('*')
      ]);
      
      if (anchorsResult.error) throw anchorsResult.error;
      if (pipelineResult.error) throw pipelineResult.error;
      if (metrosResult.error) throw metrosResult.error;
      
      let anchors = anchorsResult.data || [];
      let pipeline = pipelineResult.data || [];
      const metros = metrosResult.data || [];
      
      // Filter by metro if specified
      if (metroId) {
        anchors = anchors.filter(a => a.metro_id === metroId);
        pipeline = pipeline.filter(p => p.metro_id === metroId);
      }
      
      const now = new Date();
      
      // Count active anchors (those with first_volume_date)
      const activeAnchors = countActiveAnchors(anchors);
      
      // Count anchors formed in last 90 days
      const newAnchorsLast90Days = countAnchorsFormedInPeriod(anchors, 90, now);
      
      // Count anchors in ramp status
      const anchorsInRamp = anchors.filter(a => {
        const status = computeProductionStatus(a, now);
        return status === 'Ramp';
      }).length;
      
      // Calculate median days to first volume
      const medianDaysToFirstVolume = calculateMedianCycleTime(
        anchors, 
        'agreement_to_first_volume'
      );
      
      // Calculate total monthly volume (excluding null/zero)
      const totalMonthlyVolume = anchors.reduce((sum, a) => {
        const vol = a.avg_monthly_volume;
        return sum + (vol && vol > 0 ? vol : 0);
      }, 0);
      
      // Pipeline metrics
      const pipelineCount = pipeline.length;
      const stuckPipelineCount = pipeline.filter(p => {
        if (!p.stage_entry_date) return false;
        const entryDate = new Date(p.stage_entry_date);
        const daysDiff = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 30;
      }).length;
      
      const metroCoverage = metroId ? 1 : metros.length;
      
      // Compute metro readiness for each metro
      const allAnchors = anchorsResult.data || [];
      const allPipeline = pipelineResult.data || [];
      const metrosWithReadiness: MetroWithReadiness[] = (metroId 
        ? metros.filter(m => m.id === metroId)
        : metros
      ).map(metro => {
        const readiness = computeMetroReadiness(metro, allAnchors, allPipeline);
        return {
          ...metro,
          ...readiness
        };
      });
      
      const kpis: DashboardKPIs = {
        activeAnchors,
        newAnchorsLast90Days,
        anchorsInRamp,
        medianDaysToFirstVolume,
        totalMonthlyVolume,
        pipelineCount,
        stuckPipelineCount,
        metroCoverage
      };
      
      return {
        kpis,
        metros: metrosWithReadiness,
        anchors,
        pipeline
      };
    }
  });
}

// Filtered anchor trends by month
export function useFilteredAnchorTrends(metroId?: string | null) {
  return useQuery({
    queryKey: ['anchor-trends', metroId],
    queryFn: async () => {
      let query = supabase
        .from('anchors')
        .select('first_volume_date, metro_id')
        .not('first_volume_date', 'is', null);
      
      if (metroId) {
        query = query.eq('metro_id', metroId);
      }
      
      const { data: anchors, error } = await query;
      
      if (error) throw error;
      
      // Group by month
      const monthCounts: Record<string, number> = {};
      const now = new Date();
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthCounts[key] = 0;
      }
      
      // Count anchors by month
      (anchors || []).forEach(anchor => {
        if (anchor.first_volume_date) {
          const date = new Date(anchor.first_volume_date);
          const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          if (monthCounts.hasOwnProperty(key)) {
            monthCounts[key]++;
          }
        }
      });
      
      return Object.entries(monthCounts).map(([month, count]) => ({
        month,
        count
      }));
    }
  });
}

// Filtered pipeline by stage - combined view with opportunities for early stages
export function useFilteredPipelineByStage(metroId?: string | null) {
  return useQuery({
    queryKey: ['pipeline-by-stage', metroId],
    queryFn: async () => {
      // Fetch both opportunities (for early stages) and pipeline (for later stages)
      const [oppResult, pipelineResult] = await Promise.all([
        metroId 
          ? supabase.from('opportunities').select('stage, metro_id').eq('metro_id', metroId)
          : supabase.from('opportunities').select('stage, metro_id'),
        metroId
          ? supabase.from('anchor_pipeline').select('stage, metro_id').eq('metro_id', metroId)
          : supabase.from('anchor_pipeline').select('stage, metro_id')
      ]);
      
      if (oppResult.error) throw oppResult.error;
      if (pipelineResult.error) throw pipelineResult.error;
      
      const opportunities = oppResult.data || [];
      const pipeline = pipelineResult.data || [];
      
      // Early stages come from opportunities table
      const earlyStages = [
        'Target Identified',
        'Contacted',
        'Discovery Scheduled'
      ];
      
      // Later stages come from anchor_pipeline table
      const pipelineStages = [
        'Discovery Held',
        'Proposal Sent',
        'Agreement Pending',
        'Agreement Signed'
      ];
      
      const colors = [
        'hsl(280, 60%, 55%)',  // Target Identified
        'hsl(199, 89%, 48%)',  // Contacted
        'hsl(260, 70%, 55%)',  // Discovery Scheduled
        'hsl(217, 91%, 50%)',  // Discovery Held
        'hsl(38, 92%, 50%)',   // Proposal Sent
        'hsl(25, 95%, 53%)',   // Agreement Pending
        'hsl(142, 71%, 45%)'   // Agreement Signed
      ];
      
      const allStages = [...earlyStages, ...pipelineStages];
      
      return allStages.map((stage, index) => {
        let count: number;
        if (earlyStages.includes(stage)) {
          // Count from opportunities table
          count = opportunities.filter(o => o.stage === stage).length;
        } else {
          // Count from pipeline table
          count = pipeline.filter(p => p.stage === stage).length;
        }
        
        return {
          stage,
          count,
          color: colors[index]
        };
      });
    }
  });
}
