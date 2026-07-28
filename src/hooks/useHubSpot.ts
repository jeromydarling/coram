import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface HubSpotConnectionStatus {
  isConnected: boolean;
  oauthConfigured: boolean;
  connection: {
    id: string;
    hubspot_portal_id: string | null;
    status: string;
    hubspot_mode: string;
    pipeline_id: string | null;
    stage_mapping: Record<string, string>;
    sync_direction: string;
    sync_scope: Record<string, boolean>;
    created_at: string;
    updated_at: string;
  } | null;
}

interface SyncLogEntry {
  id: string;
  direction: string;
  entity: string;
  profunda_id: string | null;
  hubspot_id: string | null;
  status: string;
  message: string | null;
  created_at: string;
}

interface PullPreviewDiff {
  hubspotId: string;
  hubspotName: string;
  hubspotDomain: string | null;
  matchType: string;
  matchConfidence: string;
  profundaId: string | null;
  profundaName: string | null;
  fieldDiffs: Array<{
    field: string;
    profundaValue: string | null;
    hubspotValue: string | null;
    wouldOverwrite: boolean;
  }>;
}

export function useHubSpotStatus() {
  return useQuery<HubSpotConnectionStatus>({
    queryKey: ['hubspot-status'],
    queryFn: async () => {
      // functions.invoke doesn't support query params, use manual fetch
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/hubspot-connect?action=status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) throw new Error('Failed to fetch status');
      return resp.json();
    },
    staleTime: 30_000,
  });
}

export function useHubSpotSyncLog(connectionId: string | undefined) {
  return useQuery<SyncLogEntry[]>({
    queryKey: ['hubspot-sync-log', connectionId],
    enabled: !!connectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubspot_sync_log')
        .select('*')
        .eq('connection_id', connectionId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SyncLogEntry[];
    },
  });
}

export function useHubSpotConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/hubspot-connect?action=auth-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      if (data.stubbed) {
        throw new Error('HubSpot OAuth not yet configured. Add HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET first.');
      }
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
      return data;
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useHubSpotDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/hubspot-connect?action=disconnect`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) throw new Error('Failed to disconnect');
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-status'] });
      toast.success('HubSpot disconnected');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useHubSpotUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/hubspot-connect?action=update-settings`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        }
      );
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Failed to update settings');
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-status'] });
      toast.success('Settings saved');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useHubSpotPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { opportunity_ids?: string[]; contact_ids?: string[] }) => {
      const { data, error } = await supabase.functions.invoke('hubspot-push', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-sync-log'] });
      const summary = data as { total: number; ok: number; skipped: number; failed: number };
      toast.success(`Sync complete: ${summary.ok} pushed, ${summary.skipped} unchanged, ${summary.failed} failed`);
    },
    onError: (err: Error) => {
      toast.error(`Push failed: ${err.message}`);
    },
  });
}

export function useHubSpotPullPreview() {
  return useMutation({
    mutationFn: async (): Promise<{ summary: Record<string, number>; diffs: PullPreviewDiff[] }> => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/hubspot-pull?action=preview`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Preview failed');
      }
      return resp.json();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useHubSpotPullApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ hubspotId: string; profundaId: string | null; fields: Array<{ field: string; hubspotValue: string }> }>) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/hubspot-pull?action=apply`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }
      );
      if (!resp.ok) throw new Error('Apply failed');
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-sync-log'] });
      toast.success('Pull applied successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useHubSpotObjectMap(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['hubspot-object-map', opportunityId],
    enabled: !!opportunityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubspot_object_map')
        .select('hubspot_company_id, hubspot_deal_id, last_synced_at')
        .eq('opportunity_id', opportunityId!)
        .is('contact_id', null)
        .is('provision_id', null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}
