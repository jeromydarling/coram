/**
 * useGardenerTeam — Hooks for the multi-gardener system.
 *
 * WHAT: Query and mutate gardeners, scopes, and assignments.
 * WHERE: Studio Gardener tab, Inbox, routing flows.
 * WHY: Centralized data access for the gardener team feature.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useGardeners() {
  return useQuery({
    queryKey: ['gardeners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gardeners')
        .select('*')
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGardenerScopes(gardenerId?: string) {
  return useQuery({
    queryKey: ['gardener-scopes', gardenerId],
    enabled: !!gardenerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gardener_scopes')
        .select('*')
        .eq('gardener_id', gardenerId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllGardenerScopes() {
  return useQuery({
    queryKey: ['gardener-scopes-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gardener_scopes')
        .select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTenantGardenerAssignments() {
  return useQuery({
    queryKey: ['tenant-gardener-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_gardener_assignments')
        .select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddGardener() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; display_name: string; is_primary?: boolean }) => {
      // Insert gardener
      const { error: gErr } = await supabase
        .from('gardeners')
        .insert({ id: payload.id, display_name: payload.display_name, is_primary: payload.is_primary ?? false } as any);
      if (gErr) throw gErr;

      // Insert default notification settings
      const { error: nErr } = await supabase
        .from('gardener_notification_settings')
        .insert({ gardener_id: payload.id } as any);
      if (nErr) console.warn('Failed to create gardener notification settings:', nErr);

      // Audit
      await supabase.from('gardener_audit_log').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id ?? '',
        action: 'gardener_added',
        target_gardener_id: payload.id,
        details: { display_name: payload.display_name },
      } as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gardeners'] }),
  });
}

export function useUpdateGardener() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; is_active?: boolean; is_on_call?: boolean; is_primary?: boolean }) => {
      const { id, ...updates } = payload;
      const { error } = await supabase
        .from('gardeners')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gardeners'] }),
  });
}

export function useAddGardenerScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { gardener_id: string; scope_type: string; scope_key: string }) => {
      const { error } = await supabase
        .from('gardener_scopes')
        .insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gardener-scopes'] });
      qc.invalidateQueries({ queryKey: ['gardener-scopes-all'] });
    },
  });
}

export function useRemoveGardenerScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scopeId: string) => {
      const { error } = await supabase
        .from('gardener_scopes')
        .delete()
        .eq('id', scopeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gardener-scopes'] });
      qc.invalidateQueries({ queryKey: ['gardener-scopes-all'] });
    },
  });
}

export function useAssignGardenerToTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      tenant_id: string;
      gardener_id: string;
      assignment_type: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from('tenant_gardener_assignments')
        .upsert(payload as any, { onConflict: 'tenant_id,gardener_id,assignment_type' });
      if (error) throw error;

      await supabase.from('gardener_audit_log').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id ?? '',
        action: 'tenant_assigned',
        target_gardener_id: payload.gardener_id,
        target_tenant_id: payload.tenant_id,
        details: { assignment_type: payload.assignment_type, reason: payload.reason },
      } as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-gardener-assignments'] }),
  });
}
