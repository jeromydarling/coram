import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface OrgKnowledgeProfile {
  org_name?: string;
  mission?: string;
  positioning?: string;
  who_we_serve?: string[];
  who_they_serve?: string[];
  geographies?: string[];
  programs?: Array<{ name: string; summary: string }>;
  key_stats?: Array<{ label: string; value: string }>;
  tone_keywords?: string[];
  approved_claims?: string[];
  disallowed_claims?: string[];
  partnership_angles?: string[];
  sources?: Array<{ url: string; quote: string }>;
  headquarters?: { address_line1?: string; city?: string; state?: string; zip?: string };
}

interface OrgKnowledgeSnapshot {
  id: string;
  org_id: string;
  version: number;
  source_type: string;
  source_url: string;
  structured_json: OrgKnowledgeProfile;
  raw_excerpt: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  sources: Array<{
    id: string;
    url: string;
    title: string | null;
    snippet: string | null;
  }>;
}

interface VersionHistoryItem {
  id: string;
  version: number;
  source_type: string;
  created_at: string;
  created_by: string;
  notes: string | null;
}

export function useOrgKnowledge(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-knowledge', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.functions.invoke('org-knowledge-get', {
        body: { org_id: orgId, include_history: true },
      });
      if (error) throw error;
      return data as { ok: boolean; snapshot: OrgKnowledgeSnapshot | null; history: VersionHistoryItem[] };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshOrgKnowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, sourceUrl }: { orgId: string; sourceUrl: string }) => {
      const { data, error } = await supabase.functions.invoke('org-knowledge-refresh', {
        body: { org_id: orgId, source_url: sourceUrl, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-knowledge', variables.orgId] });
      toast.success('Organization knowledge refreshed from website');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh');
    },
  });
}

export function useUpdateOrgKnowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, patch, notes }: { orgId: string; patch: Record<string, unknown>; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke('org-knowledge-update', {
        body: { org_id: orgId, patch, notes },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-knowledge', variables.orgId] });
      toast.success('Organization knowledge updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    },
  });
}

export function useFindOrgAddress() {
  return useMutation({
    mutationFn: async ({ orgId, orgName, websiteUrl }: { orgId: string; orgName: string; websiteUrl?: string }) => {
      const { data, error } = await supabase.functions.invoke('org-knowledge-find-address', {
        body: { org_id: orgId, org_name: orgName, website_url: websiteUrl },
      });
      if (error) throw error;
      return data as { ok: boolean; found: boolean; confidence?: string; headquarters?: { address_line1: string; city: string; state: string; zip: string }; message?: string };
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to find address');
    },
  });
}
