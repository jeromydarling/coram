import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { computeProductionStatus, calculateCycleTime } from '@/lib/computations';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { useLogAudit, computeChanges } from './useAuditLog';

export interface AnchorWithComputed {
  id: string;
  anchor_id: string;
  opportunity_id: string | null;
  metro_id: string | null;
  anchor_tier: 'Strategic' | 'Standard' | 'Pilot' | null;
  first_contact_date: string | null;
  discovery_date: string | null;
  agreement_signed_date: string | null;
  first_volume_date: string | null;
  stable_producer_date: string | null;
  last_30_day_volume: number | null;
  avg_monthly_volume: number | null;
  peak_monthly_volume: number | null;
  growth_trend: 'Up' | 'Flat' | 'Down' | null;
  risk_level: 'Low' | 'Medium' | 'High' | null;
  strategic_value_1to5: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined
  organization?: string;
  metro?: string;
  // Computed
  monthsActive: number;
  productionStatus: 'Pre-Production' | 'Ramp' | 'Stable' | 'Scale';
  daysContactToAgreement: number | null;
  daysAgreementToFirstVolume: number | null;
  daysFirstToStable: number | null;
}

function computeAnchorFields(anchor: any): AnchorWithComputed {
  const now = new Date();
  
  // Compute months active
  let monthsActive = 0;
  if (anchor.first_volume_date) {
    const volumeDate = parseISO(anchor.first_volume_date);
    if (isValid(volumeDate)) {
      monthsActive = Math.floor(differenceInDays(now, volumeDate) / 30);
    }
  }
  
  // Compute production status
  const productionStatus = computeProductionStatus({
    first_volume_date: anchor.first_volume_date,
    avg_monthly_volume: anchor.avg_monthly_volume
  }, now);
  
  // Compute cycle times
  const daysContactToAgreement = calculateCycleTime(
    anchor.first_contact_date,
    anchor.agreement_signed_date
  );
  const daysAgreementToFirstVolume = calculateCycleTime(
    anchor.agreement_signed_date,
    anchor.first_volume_date
  );
  const daysFirstToStable = calculateCycleTime(
    anchor.first_volume_date,
    anchor.stable_producer_date
  );
  
  return {
    ...anchor,
    organization: anchor.opportunities?.organization,
    metro: anchor.metros?.metro,
    monthsActive,
    productionStatus,
    daysContactToAgreement,
    daysAgreementToFirstVolume,
    daysFirstToStable
  };
}

export function useAnchors() {
  return useQuery({
    queryKey: ['anchors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anchors')
        .select(`
          *,
          opportunities (organization),
          metros (metro)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Compute dynamic fields for each anchor
      return (data || []).map(computeAnchorFields);
    }
  });
}

export function useCreateAnchor() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (anchor: {
      anchor_id: string;
      opportunity_id?: string;
      metro_id?: string;
      anchor_tier?: 'Strategic' | 'Standard' | 'Pilot';
      first_contact_date?: string;
      discovery_date?: string;
      agreement_signed_date?: string;
      first_volume_date?: string;
      stable_producer_date?: string;
      last_30_day_volume?: number;
      avg_monthly_volume?: number;
      peak_monthly_volume?: number;
      growth_trend?: 'Up' | 'Flat' | 'Down';
      risk_level?: 'Low' | 'Medium' | 'High';
      strategic_value_1to5?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('anchors')
        .insert(anchor)
        .select(`
          *,
          opportunities (organization),
          metros (metro)
        `)
        .single();
      
      if (error) throw error;
      return computeAnchorFields(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['anchors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      toast.success('Anchor created successfully');
      
      // Log audit
      logAudit.mutate({
        action: 'create',
        entityType: 'anchor',
        entityId: data.id,
        entityName: data.organization || data.anchor_id
      });
    },
    onError: (error) => {
      toast.error(`Failed to create anchor: ${error.message}`);
    }
  });
}

export function useUpdateAnchor() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, _previousData, ...anchor }: {
      id: string;
      _previousData?: Record<string, unknown>;
      anchor_tier?: 'Strategic' | 'Standard' | 'Pilot';
      first_contact_date?: string | null;
      discovery_date?: string | null;
      agreement_signed_date?: string | null;
      first_volume_date?: string | null;
      stable_producer_date?: string | null;
      last_30_day_volume?: number;
      avg_monthly_volume?: number;
      peak_monthly_volume?: number;
      growth_trend?: 'Up' | 'Flat' | 'Down';
      risk_level?: 'Low' | 'Medium' | 'High';
      strategic_value_1to5?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('anchors')
        .update(anchor)
        .eq('id', id)
        .select(`
          *,
          opportunities (organization),
          metros (metro)
        `)
        .single();
      
      if (error) throw error;
      return { data: computeAnchorFields(data), previousData: _previousData };
    },
    onSuccess: ({ data, previousData }) => {
      queryClient.invalidateQueries({ queryKey: ['anchors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      toast.success('Anchor updated successfully');
      
      // Log audit with changes
      const changes = previousData 
        ? computeChanges(previousData, data as unknown as Record<string, unknown>)
        : null;
      
      logAudit.mutate({
        action: 'update',
        entityType: 'anchor',
        entityId: data.id,
        entityName: data.organization || data.anchor_id,
        changes: changes || undefined
      });
    },
    onError: (error) => {
      toast.error(`Failed to update anchor: ${error.message}`);
    }
  });
}
