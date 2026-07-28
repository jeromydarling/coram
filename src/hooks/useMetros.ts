import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit, computeChanges } from './useAuditLog';

// Computed scores based on metro data
function computeMetroScores(metro: any) {
  // Anchor Score: based on active anchors (we'll compute from related data)
  // For now, we use a simplified calculation based on available fields
  const anchorScore = Math.min(
    100,
    (metro.workforce_partners || 0) * 5 +
    (metro.housing_refugee_partners || 0) * 5 +
    (metro.schools_libraries || 0) * 3
  );

  // Demand Score: based on referrals, inquiries, waitlist
  const demandScore = Math.min(
    100,
    (metro.referrals_per_month || 0) * 2 +
    (metro.partner_inquiries_per_month || 0) * 3 +
    Math.min((metro.waitlist_size || 0) / 10, 30)
  );

  // Ops Score: based on operational readiness
  const opsScore = Math.min(
    100,
    (metro.distribution_partner_yn ? 25 : 0) +
    (metro.storage_ready_yn ? 25 : 0) +
    ((metro.staff_coverage_1to5 || 1) * 10)
  );

  const metroReadinessIndex = Math.round((anchorScore + demandScore + opsScore) / 3);

  // Determine status based on readiness index
  let metroStatus: 'Expansion Ready' | 'Anchor Build' | 'Ecosystem Dev';
  if (metroReadinessIndex >= 75) {
    metroStatus = 'Expansion Ready';
  } else if (metroReadinessIndex >= 50) {
    metroStatus = 'Anchor Build';
  } else {
    metroStatus = 'Ecosystem Dev';
  }

  return {
    anchorScore,
    demandScore,
    opsScore,
    metroReadinessIndex,
    metroStatus
  };
}

export interface MetroWithComputed {
  id: string;
  metro_id: string;
  metro: string;
  region_id: string | null;
  referrals_per_month: number | null;
  partner_inquiries_per_month: number | null;
  waitlist_size: number | null;
  distribution_partner_yn: boolean | null;
  storage_ready_yn: boolean | null;
  staff_coverage_1to5: number | null;
  workforce_partners: number | null;
  housing_refugee_partners: number | null;
  schools_libraries: number | null;
  recommendation: 'Invest' | 'Build Anchors' | 'Hold' | 'Triage' | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Computed
  anchorScore: number;
  demandScore: number;
  opsScore: number;
  metroReadinessIndex: number;
  metroStatus: 'Expansion Ready' | 'Anchor Build' | 'Ecosystem Dev';
  // Counts from related tables
  activeAnchors: number;
  anchorsInPipeline: number;
  // Region info
  region?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export function useMetros() {
  return useQuery({
    queryKey: ['metros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metros')
        .select('*')
        .order('metro', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });
}

export function useMetrosWithComputed() {
  return useQuery({
    queryKey: ['metros-computed'],
    queryFn: async () => {
      // Fetch metros with region info
      const { data: metros, error: metrosError } = await supabase
        .from('metros')
        .select(`
          *,
          regions (id, name, color)
        `)
        .order('metro', { ascending: true });
      
      if (metrosError) throw metrosError;

      // Fetch anchor counts per metro
      const { data: anchors } = await supabase
        .from('anchors')
        .select('metro_id');

      // Fetch pipeline counts per metro
      const { data: pipeline } = await supabase
        .from('anchor_pipeline')
        .select('metro_id');

      // Count anchors and pipeline by metro
      const anchorCounts = new Map<string, number>();
      const pipelineCounts = new Map<string, number>();

      anchors?.forEach(a => {
        if (a.metro_id) {
          anchorCounts.set(a.metro_id, (anchorCounts.get(a.metro_id) || 0) + 1);
        }
      });

      pipeline?.forEach(p => {
        if (p.metro_id) {
          pipelineCounts.set(p.metro_id, (pipelineCounts.get(p.metro_id) || 0) + 1);
        }
      });

      // Compute scores for each metro
      return (metros || []).map(metro => {
        const scores = computeMetroScores(metro);
        // Extract region from nested response
        const regionData = (metro as any).regions;
        return {
          ...metro,
          ...scores,
          activeAnchors: anchorCounts.get(metro.id) || 0,
          anchorsInPipeline: pipelineCounts.get(metro.id) || 0,
          region: regionData ? {
            id: regionData.id,
            name: regionData.name,
            color: regionData.color
          } : null
        } as MetroWithComputed;
      });
    }
  });
}

export function useCreateMetro() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (metro: {
      metro_id: string;
      metro: string;
      region_id?: string | null;
      referrals_per_month?: number;
      partner_inquiries_per_month?: number;
      waitlist_size?: number;
      distribution_partner_yn?: boolean;
      storage_ready_yn?: boolean;
      staff_coverage_1to5?: number;
      workforce_partners?: number;
      housing_refugee_partners?: number;
      schools_libraries?: number;
      recommendation?: 'Invest' | 'Build Anchors' | 'Hold' | 'Triage';
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('metros')
        .insert(metro)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metros'] });
      queryClient.invalidateQueries({ queryKey: ['metros-computed'] });
      toast.success('Metro created successfully');
      
      logAudit.mutate({
        action: 'create',
        entityType: 'metro',
        entityId: data.id,
        entityName: data.metro
      });
    },
    onError: (error) => {
      toast.error(`Failed to create metro: ${error.message}`);
    }
  });
}

export function useUpdateMetro() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, _previousData, ...metro }: {
      id: string;
      _previousData?: Record<string, unknown>;
      metro?: string;
      region_id?: string | null;
      referrals_per_month?: number | null;
      partner_inquiries_per_month?: number | null;
      waitlist_size?: number | null;
      distribution_partner_yn?: boolean | null;
      storage_ready_yn?: boolean | null;
      staff_coverage_1to5?: number | null;
      workforce_partners?: number | null;
      housing_refugee_partners?: number | null;
      schools_libraries?: number | null;
      recommendation?: 'Invest' | 'Build Anchors' | 'Hold' | 'Triage' | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('metros')
        .update(metro)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { data, previousData: _previousData };
    },
    onSuccess: ({ data, previousData }) => {
      queryClient.invalidateQueries({ queryKey: ['metros'] });
      queryClient.invalidateQueries({ queryKey: ['metros-computed'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      toast.success('Metro updated successfully');
      
      const changes = previousData 
        ? computeChanges(previousData, data as unknown as Record<string, unknown>)
        : null;
      
      logAudit.mutate({
        action: 'update',
        entityType: 'metro',
        entityId: data.id,
        entityName: data.metro,
        changes: changes || undefined
      });
    },
    onError: (error) => {
      toast.error(`Failed to update metro: ${error.message}`);
    }
  });
}

export function useDeleteMetro() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('metros')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, name };
    },
    onSuccess: ({ id, name }) => {
      queryClient.invalidateQueries({ queryKey: ['metros'] });
      queryClient.invalidateQueries({ queryKey: ['metros-computed'] });
      toast.success('Metro deleted successfully');
      
      logAudit.mutate({
        action: 'delete',
        entityType: 'metro',
        entityId: id,
        entityName: name
      });
    },
    onError: (error) => {
      toast.error(`Failed to delete metro: ${error.message}`);
    }
  });
}
