import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface OrgWatchlistRow {
  id: string;
  org_id: string;
  website_url: string;
  enabled: boolean;
  cadence: string;
  tags: Record<string, unknown>;
  last_crawled_at: string | null;
  created_at: string;
}

export interface OrgSnapshot {
  id: string;
  org_id: string;
  url: string;
  crawled_at: string;
  content_hash: string;
  created_at: string;
}

export interface OrgSnapshotDiff {
  id: string;
  org_id: string;
  from_snapshot_id: string | null;
  to_snapshot_id: string;
  diff: Record<string, unknown>;
  created_at: string;
}

export interface OrgWatchlistSignal {
  id: string;
  org_id: string;
  diff_id: string | null;
  snapshot_id: string | null;
  signal_type: string;
  summary: string;
  confidence: number;
  created_at: string;
}

export function useOrgWatchlist(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-watchlist', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('org_watchlist')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return data as OrgWatchlistRow | null;
    },
    enabled: !!orgId,
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, websiteUrl, cadence = 'weekly' }: { orgId: string; websiteUrl: string; cadence?: string }) => {
      const { data, error } = await supabase
        .from('org_watchlist')
        .insert({ org_id: orgId, website_url: websiteUrl, enabled: true, cadence })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['org-watchlist', vars.orgId] });
      toast.success('Added to watchlist');
    },
    onError: (err) => {
      toast.error(`Failed to add: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });
}

export function useUpdateOrgWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, updates }: { orgId: string; updates: Partial<Pick<OrgWatchlistRow, 'enabled' | 'cadence' | 'website_url'>> }) => {
      const { data, error } = await supabase
        .from('org_watchlist')
        .update(updates)
        .eq('org_id', orgId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['org-watchlist', vars.orgId] });
      toast.success('Watchlist settings updated');
    },
    onError: (err) => {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });
}

export function useOrgSnapshots(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-snapshots', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_snapshots')
        .select('id, org_id, url, crawled_at, content_hash, created_at')
        .eq('org_id', orgId)
        .order('crawled_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as OrgSnapshot[];
    },
    enabled: !!orgId,
  });
}

export function useOrgDiffs(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-diffs', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_snapshot_diffs')
        .select('id, org_id, from_snapshot_id, to_snapshot_id, diff, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as OrgSnapshotDiff[];
    },
    enabled: !!orgId,
  });
}

export function useOrgWatchlistSignals(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-watchlist-signals', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_watchlist_signals')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as OrgWatchlistSignal[];
    },
    enabled: !!orgId,
  });
}
