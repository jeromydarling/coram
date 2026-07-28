/**
 * useImpactDimensions — CRUD hooks for tenant Impact Dimensions.
 *
 * WHAT: Read/write impact_dimensions and impact_dimension_values.
 * WHERE: Settings > Impact Dimensions, entity forms (events/activities/provisions).
 * WHY: Structured, tenant-configurable impact metrics for NRI narrative rollups.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface ImpactDimension {
  id: string;
  tenant_id: string;
  entity_type: 'event' | 'activity' | 'provision';
  key: string;
  label: string;
  description: string | null;
  value_type: 'integer' | 'decimal' | 'currency' | 'boolean';
  aggregation_type: 'sum' | 'avg' | 'count' | 'max';
  is_public_eligible: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ImpactDimensionValue {
  id: string;
  tenant_id: string;
  dimension_id: string;
  entity_id: string;
  value_numeric: number | null;
  value_boolean: boolean | null;
  created_at: string;
  created_by: string | null;
}

// ─── Dimensions CRUD ────────────────────────────────

export function useImpactDimensions(entityType?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['impact-dimensions', tenantId, entityType],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from('impact_dimensions')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: true });

      if (entityType) {
        q = q.eq('entity_type', entityType);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ImpactDimension[];
    },
  });
}

export function useActiveImpactDimensions(entityType: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['impact-dimensions-active', tenantId, entityType],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_dimensions')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('entity_type', entityType)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ImpactDimension[];
    },
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export function useCreateImpactDimension() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (input: {
      entityType: string;
      label: string;
      description?: string;
      valueType: string;
      aggregationType: string;
      isPublicEligible?: boolean;
    }) => {
      if (!tenantId) throw new Error('No tenant');
      const key = slugify(input.label);
      if (!key) throw new Error('Label produces empty key');

      // Enforce max 12 per entity type
      const { count, error: countErr } = await supabase
        .from('impact_dimensions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('entity_type', input.entityType)
        .eq('is_active', true);

      if (countErr) throw countErr;
      if ((count ?? 0) >= 12) throw new Error('Maximum 12 active dimensions per entity type');

      const { data, error } = await supabase
        .from('impact_dimensions')
        .insert({
          tenant_id: tenantId,
          entity_type: input.entityType,
          key,
          label: input.label.trim(),
          description: input.description?.trim() || null,
          value_type: input.valueType,
          aggregation_type: input.aggregationType,
          is_public_eligible: input.isPublicEligible ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['impact-dimensions'] });
      qc.invalidateQueries({ queryKey: ['impact-dimensions-active'] });
      toast.success('Impact dimension created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateImpactDimension() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      label?: string;
      description?: string | null;
      isActive?: boolean;
      isPublicEligible?: boolean;
    }) => {
      const updates: Record<string, any> = {};
      if (input.label !== undefined) updates.label = input.label.trim();
      if (input.description !== undefined) updates.description = input.description;
      if (input.isActive !== undefined) updates.is_active = input.isActive;
      if (input.isPublicEligible !== undefined) updates.is_public_eligible = input.isPublicEligible;

      const { error } = await supabase
        .from('impact_dimensions')
        .update(updates)
        .eq('id', input.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['impact-dimensions'] });
      qc.invalidateQueries({ queryKey: ['impact-dimensions-active'] });
      toast.success('Dimension updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Dimension Values CRUD ────────────────────────────

export function useImpactValues(entityId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['impact-values', tenantId, entityId],
    enabled: !!tenantId && !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_dimension_values')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('entity_id', entityId!);

      if (error) throw error;
      return (data ?? []) as ImpactDimensionValue[];
    },
  });
}

export function useSaveImpactValues() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      entityId: string;
      values: Array<{
        dimensionId: string;
        valueNumeric?: number | null;
        valueBoolean?: boolean | null;
      }>;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Missing context');

      // Upsert each value
      for (const v of input.values) {
        const { error } = await supabase
          .from('impact_dimension_values')
          .upsert(
            {
              tenant_id: tenantId,
              dimension_id: v.dimensionId,
              entity_id: input.entityId,
              value_numeric: v.valueNumeric ?? null,
              value_boolean: v.valueBoolean ?? null,
              created_by: user.id,
            },
            { onConflict: 'dimension_id,entity_id' }
          );
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['impact-values', tenantId, vars.entityId] });
      toast.success('Impact saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Aggregated totals for reports ────────────────────

export interface AggregatedDimension {
  dimension_id: string;
  label: string;
  aggregation_type: string;
  value_type: string;
  total: number;
}

export function useAggregatedImpact(dateRange?: { start: string; end: string }) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['impact-aggregated', tenantId, dateRange?.start, dateRange?.end],
    enabled: !!tenantId,
    queryFn: async () => {
      // Fetch all active dimensions
      const { data: dims, error: dimErr } = await supabase
        .from('impact_dimensions')
        .select('id, label, aggregation_type, value_type')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);

      if (dimErr) throw dimErr;
      if (!dims?.length) return [];

      // Fetch all values for these dimensions
      const dimIds = dims.map(d => d.id);
      let valQuery = supabase
        .from('impact_dimension_values')
        .select('dimension_id, value_numeric')
        .eq('tenant_id', tenantId!)
        .in('dimension_id', dimIds)
        .not('value_numeric', 'is', null);

      const { data: vals, error: valErr } = await valQuery;
      if (valErr) throw valErr;

      // Aggregate
      const results: AggregatedDimension[] = dims.map(dim => {
        const dimVals = (vals ?? [])
          .filter(v => v.dimension_id === dim.id)
          .map(v => v.value_numeric as number);

        let total = 0;
        if (dimVals.length > 0) {
          switch (dim.aggregation_type) {
            case 'sum': total = dimVals.reduce((a, b) => a + b, 0); break;
            case 'avg': total = dimVals.reduce((a, b) => a + b, 0) / dimVals.length; break;
            case 'count': total = dimVals.length; break;
            case 'max': total = Math.max(...dimVals); break;
          }
        }

        return {
          dimension_id: dim.id,
          label: dim.label,
          aggregation_type: dim.aggregation_type,
          value_type: dim.value_type,
          total: Math.round(total * 100) / 100,
        };
      });

      return results.filter(r => r.total > 0).slice(0, 6);
    },
  });
}
