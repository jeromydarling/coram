/**
 * useCaregiverNetwork — Hooks for caregiver network features.
 *
 * WHAT: Query/mutation hooks for caregiver profiles, requests, messages, reports.
 * WHERE: CaregiverNetworkPage and related components.
 * WHY: Single source of truth for caregiver network data access with RLS enforcement.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

// ── Profile ─────────────────────────────────────────────────

export function useCaregiverProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['caregiver-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caregiver_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertCaregiverProfile() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (fields: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from('caregiver_profiles')
        .upsert(
          { user_id: user!.id, tenant_id: tenantId!, ...fields },
          { onConflict: 'tenant_id,user_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caregiver-profile', user?.id] });
    },
  });
}

// ── Browse ──────────────────────────────────────────────────

export function useBrowseCaregivers(filters?: {
  state?: string;
  tags?: string[];
  page?: number;
}) {
  const pageSize = 20;
  const page = filters?.page ?? 0;

  return useQuery({
    queryKey: ['caregiver-browse', filters],
    queryFn: async () => {
      let q = supabase
        .from('caregiver_profiles')
        .select('id, display_name, base_city, base_state_code, availability_tags, support_needs, bio_short, contact_visibility')
        .eq('network_opt_in', true)
        .is('hidden_at', null)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.state) {
        q = q.eq('base_state_code', filters.state);
      }
      if (filters?.tags?.length) {
        q = q.overlaps('availability_tags', filters.tags);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Requests ────────────────────────────────────────────────

export function useSendRequest() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ to_profile_id, message }: { to_profile_id: string; message: string }) => {
      const { error } = await supabase
        .from('caregiver_network_requests')
        .insert({ from_user_id: user!.id, to_profile_id, message });
      if (error) {
        // Friendly error for duplicate/blocked/self-request
        if (error.code === '23505') throw new Error('You already have a pending or active connection with this caregiver.');
        if (error.message?.includes('yourself')) throw new Error('You cannot send a request to yourself.');
        if (error.message?.includes('not available')) throw new Error('This connection is not available.');
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caregiver-requests'] });
    },
  });
}

export function useMyRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['caregiver-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get my profile
      const { data: myProfile } = await supabase
        .from('caregiver_profiles')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      // Incoming requests (to my profile) — join on from_user_id's profile for sender name
      let incoming: any[] = [];
      if (myProfile) {
        const { data } = await supabase
          .from('caregiver_network_requests')
          .select('*')
          .eq('to_profile_id', myProfile.id)
          .order('created_at', { ascending: false });

        if (data?.length) {
          // Get sender profiles for display names
          const senderIds = [...new Set(data.map(r => r.from_user_id))];
          const { data: senderProfiles } = await supabase
            .from('caregiver_profiles')
            .select('user_id, display_name')
            .in('user_id', senderIds);

          const senderMap = new Map(
            (senderProfiles ?? []).map(p => [p.user_id, p.display_name])
          );

          incoming = data.map(r => ({
            ...r,
            sender_display_name: senderMap.get(r.from_user_id) || 'A caregiver',
          }));
        }
      }

      // Outgoing requests — join on to_profile_id for recipient name
      const { data: outgoing } = await supabase
        .from('caregiver_network_requests')
        .select('*, caregiver_profiles!caregiver_network_requests_to_profile_id_fkey(display_name)')
        .eq('from_user_id', user!.id)
        .order('created_at', { ascending: false });

      return { incoming, outgoing: outgoing ?? [] };
    },
  });
}

export function useUpdateRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'accepted' | 'declined' | 'blocked' }) => {
      const { error } = await supabase
        .from('caregiver_network_requests')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caregiver-requests'] });
      qc.invalidateQueries({ queryKey: ['caregiver-messages'] });
    },
  });
}

// ── Messages ────────────────────────────────────────────────

export function useNetworkMessages(requestId: string | null) {
  return useQuery({
    queryKey: ['caregiver-messages', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caregiver_network_messages')
        .select('*')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ request_id, body }: { request_id: string; body: string }) => {
      const { error } = await supabase
        .from('caregiver_network_messages')
        .insert({ request_id, sender_user_id: user!.id, body });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['caregiver-messages', vars.request_id] });
    },
  });
}

// ── Reports ─────────────────────────────────────────────────

export function useSubmitReport() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (report: {
      reported_profile_id?: string;
      reported_request_id?: string;
      reported_message_id?: string;
      reason: string;
    }) => {
      // Insert the report
      const { error } = await supabase
        .from('caregiver_network_reports')
        .insert({ reporter_user_id: user!.id, ...report });
      if (error) throw error;

      // #1/#14: Also flag the message as reported so Gardener RLS can see it
      if (report.reported_message_id) {
        const { error: flagError } = await supabase
          .from('caregiver_network_messages')
          .update({ reported: true, reported_reason: report.reason })
          .eq('id', report.reported_message_id);
        if (flagError) {
          console.warn('Report saved but message flag failed:', flagError.message);
        }
      }
    },
  });
}
