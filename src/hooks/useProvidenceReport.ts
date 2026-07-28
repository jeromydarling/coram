/**
 * useProvidenceReport — Fetches and manages Providence reports for the current tenant.
 *
 * WHAT: Reads most recent report, provides generation trigger, version history, and report switching.
 * WHERE: Compass drawer "Providence — This Season" section.
 * WHY: Tenant-scoped seasonal arc reflection — the long-arc counterpart to daily nudges.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { useState } from 'react';

export interface ProvidenceReport {
  id: string;
  tenant_id: string;
  season_label: string;
  dominant_direction: string;
  classification: string;
  narrative_private: string;
  narrative_shareable: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  trigger_type: string;
  version: number;
  created_by: string | null;
  revelation_start: string | null;
  revelation_end: string | null;
  revelation_type: string | null;
  foundational: boolean;
}

export function useProvidenceReport() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const latestQuery = useQuery({
    queryKey: ['providence-report', tenantId],
    enabled: !!tenantId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providence_reports')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ProvidenceReport | null;
    },
  });

  const historyQuery = useQuery({
    queryKey: ['providence-history', tenantId],
    enabled: !!tenantId && !!latestQuery.data,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providence_reports')
        .select('id, season_label, classification, generated_at, version, period_start, period_end')
        .eq('tenant_id', tenantId!)
        .order('generated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Pick<
        ProvidenceReport,
        'id' | 'season_label' | 'classification' | 'generated_at' | 'version' | 'period_start' | 'period_end'
      >[];
    },
  });

  // Load a specific historical report by ID
  const specificQuery = useQuery({
    queryKey: ['providence-report-specific', selectedId],
    enabled: !!selectedId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providence_reports')
        .select('*')
        .eq('id', selectedId!)
        .single();
      if (error) throw error;
      return data as ProvidenceReport;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (triggerType: 'quarterly' | 'arc_shift' | 'manual' = 'manual') => {
      const { data, error } = await supabase.functions.invoke('generate-providence', {
        body: { tenant_id: tenantId, trigger_type: triggerType },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Generation failed');
      return data.report;
    },
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['providence-report', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['providence-history', tenantId] });
      toast.success('Providence reflection generated');
    },
    onError: (err: Error) => {
      toast.error(`Could not generate reflection: ${err.message}`);
    },
  });

  // Active report: selected historical one or latest
  const activeReport = selectedId ? specificQuery.data : latestQuery.data;

  return {
    report: activeReport ?? null,
    isLoading: latestQuery.isLoading,
    history: historyQuery.data ?? [],
    generate: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    loadReport: (id: string) => setSelectedId(id === latestQuery.data?.id ? null : id),
  };
}
