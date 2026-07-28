import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  countActiveAnchors, 
  countAnchorsFormedInPeriod,
  computeMetroReadiness,
  calculateMedianCycleTime,
  computeProductionStatus
} from '@/lib/computations';

export interface DashboardKPIs {
  activeAnchors: number;
  newAnchorsLast90Days: number;
  anchorsInRamp: number;
  medianDaysToFirstVolume: number;
  totalMonthlyVolume: number;
  pipelineCount: number;
  stuckPipelineCount: number;
  metroCoverage: number;
}

export interface MetroWithReadiness {
  id: string;
  metro_id: string;
  metro: string;
  referrals_per_month: number | null;
  partner_inquiries_per_month: number | null;
  distribution_partner_yn: boolean | null;
  storage_ready_yn: boolean | null;
  staff_coverage_1to5: number | null;
  recommendation: 'Invest' | 'Build Anchors' | 'Hold' | 'Triage' | null;
  notes: string | null;
  // Computed
  activeAnchors: number;
  anchorsInPipeline: number;
  anchorScore: number;
  demandScore: number;
  opsScore: number;
  metroReadinessIndex: number;
  metroStatus: 'Expansion Ready' | 'Anchor Build' | 'Ecosystem Dev';
}

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard-kpis'],
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
      
      const anchors = anchorsResult.data || [];
      const pipeline = pipelineResult.data || [];
      const metros = metrosResult.data || [];
      
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
      
      const metroCoverage = metros.length;
      
      // Compute metro readiness for each metro
      const metrosWithReadiness: MetroWithReadiness[] = metros.map(metro => {
        const readiness = computeMetroReadiness(metro, anchors, pipeline);
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
        metros: metrosWithReadiness
      };
    }
  });
}

// Separate hook for anchor trends by month
export function useAnchorTrends() {
  return useQuery({
    queryKey: ['anchor-trends'],
    queryFn: async () => {
      const { data: anchors, error } = await supabase
        .from('anchors')
        .select('first_volume_date')
        .not('first_volume_date', 'is', null);
      
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

// Hook for pipeline by stage (uses chapter labels for display)
export function usePipelineByStage() {
  return useQuery({
    queryKey: ['pipeline-by-stage'],
    queryFn: async () => {
      // Early stages come from opportunities, later stages from anchor_pipeline
      const [oppResult, pipelineResult] = await Promise.all([
        supabase.from('opportunities').select('stage').in('stage', [
          'Target Identified', 'Contacted', 'Discovery Scheduled',
          'Found' as any, 'First Conversation' as any, 'Discovery' as any,
        ]),
        supabase.from('anchor_pipeline').select('stage'),
      ]);
      
      if (oppResult.error) throw oppResult.error;
      if (pipelineResult.error) throw pipelineResult.error;
      
      const opportunities = oppResult.data || [];
      const pipeline = pipelineResult.data || [];
      
      // Import chapter mapping
      const { toChapterLabel, JOURNEY_KANBAN_CHAPTERS, CHAPTER_COLORS } = await import('@/lib/journeyChapters');
      
      return JOURNEY_KANBAN_CHAPTERS.map((chapter) => {
        // Count items whose stored stage maps to this chapter
        const oppCount = opportunities.filter(o => toChapterLabel(o.stage) === chapter).length;
        const pipeCount = pipeline.filter(p => toChapterLabel(p.stage) === chapter).length;
        return { stage: chapter, count: oppCount + pipeCount, color: CHAPTER_COLORS[chapter] };
      });
    }
  });
}
