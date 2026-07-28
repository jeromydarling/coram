import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SparklineData {
  value: number;
}

export function useKPISparklines(metroId?: string | null) {
  return useQuery({
    queryKey: ['kpi-sparklines', metroId],
    queryFn: async () => {
      const now = new Date();
      
      // Fetch anchors with first_volume_date for trending
      let anchorsQuery = supabase
        .from('anchors')
        .select('first_volume_date, avg_monthly_volume, metro_id');
      
      if (metroId) {
        anchorsQuery = anchorsQuery.eq('metro_id', metroId);
      }
      
      const { data: anchors } = await anchorsQuery;
      
      // Fetch pipeline for pipeline trends
      let pipelineQuery = supabase
        .from('anchor_pipeline')
        .select('created_at, metro_id');
      
      if (metroId) {
        pipelineQuery = pipelineQuery.eq('metro_id', metroId);
      }
      
      const { data: pipeline } = await pipelineQuery;
      
      // Generate 6-month sparkline data for active anchors
      const activeAnchorsSparkline: SparklineData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const activeCount = (anchors || []).filter(a => {
          if (!a.first_volume_date) return false;
          return new Date(a.first_volume_date) <= monthEnd;
        }).length;
        activeAnchorsSparkline.push({ value: activeCount });
      }
      
      // Generate sparkline for new anchors per month
      const newAnchorsSparkline: SparklineData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const newCount = (anchors || []).filter(a => {
          if (!a.first_volume_date) return false;
          const date = new Date(a.first_volume_date);
          return date >= monthStart && date <= monthEnd;
        }).length;
        newAnchorsSparkline.push({ value: newCount });
      }
      
      // Generate sparkline for pipeline count
      const pipelineSparkline: SparklineData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const count = (pipeline || []).filter(p => {
          if (!p.created_at) return false;
          return new Date(p.created_at) <= monthEnd;
        }).length;
        pipelineSparkline.push({ value: count });
      }
      
      // Generate sparkline for volume trend
      const volumeSparkline: SparklineData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const totalVolume = (anchors || [])
          .filter(a => {
            if (!a.first_volume_date) return false;
            return new Date(a.first_volume_date) <= monthEnd;
          })
          .reduce((sum, a) => sum + (a.avg_monthly_volume || 0), 0);
        volumeSparkline.push({ value: totalVolume });
      }
      
      return {
        activeAnchors: activeAnchorsSparkline,
        newAnchors: newAnchorsSparkline,
        pipeline: pipelineSparkline,
        volume: volumeSparkline
      };
    }
  });
}
