import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface SavedSearch {
  id: string;
  user_id: string;
  module: string;
  scope: string;
  metro_id: string | null;
  name: string;
  raw_query: string;
  enforced_query_template: string;
  max_results: number;
  last_run_id: string | null;
  last_ran_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchResult {
  id: string;
  result_index: number;
  title: string;
  description: string | null;
  url: string | null;
  source: string | null;
  location: string | null;
  date_info: string | null;
  organization: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  confidence: number | null;
  entity_created: boolean;
  created_entity_id: string | null;
  is_new: boolean;
  raw_data: Record<string, unknown> | null;
}

export interface SavedSearchResultsResponse {
  ok: boolean;
  results: SavedSearchResult[];
  summary: { new_count: number; total: number };
}

export function useSavedSearches(module: string) {
  return useQuery({
    queryKey: ['saved-searches', module],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('saved-searches/list', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
      });
      // The invoke for GET with query params doesn't work well, use POST list alternative
      // Actually, let's use the function invoke with the query param approach
      if (error) throw error;
      const result = data as { ok: boolean; saved_searches: SavedSearch[] };
      if (!result?.ok) throw new Error('Failed to load saved searches');
      return (result.saved_searches || []).filter((s: SavedSearch) => s.module === module);
    },
  });
}

export function useSavedSearchList(module: string) {
  return useQuery({
    queryKey: ['saved-searches', module],
    queryFn: async () => {
      // Use the list endpoint
      const { data, error } = await supabase.functions.invoke(`saved-searches/list?module=${module}`, {
        method: 'GET',
      });
      if (error) throw error;
      const result = data as { ok: boolean; saved_searches: SavedSearch[] };
      if (!result?.ok) throw new Error('Failed to load saved searches');
      return result.saved_searches || [];
    },
    staleTime: 30_000,
  });
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      module: string;
      scope: string;
      metro_id?: string;
      name: string;
      raw_query: string;
      max_results?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('saved-searches/create', {
        body: params,
      });
      if (error) throw error;
      const result = data as { ok: boolean; saved_search: SavedSearch; message?: string };
      if (!result?.ok) throw new Error(result?.message || 'Failed to create saved search');
      return result.saved_search;
    },
    onSuccess: (_, vars) => {
      toast.success('Search saved');
      queryClient.invalidateQueries({ queryKey: ['saved-searches', vars.module] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save search');
    },
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; module: string }) => {
      const { data, error } = await supabase.functions.invoke('saved-searches/delete', {
        body: { id: params.id },
      });
      if (error) throw error;
      const result = data as { ok: boolean; message?: string };
      if (!result?.ok) throw new Error(result?.message || 'Failed to delete');
      return result;
    },
    onSuccess: (_, vars) => {
      toast.success('Saved search deleted');
      queryClient.invalidateQueries({ queryKey: ['saved-searches', vars.module] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    },
  });
}

export function useRenameSavedSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; name: string; module: string }) => {
      const { data, error } = await supabase.functions.invoke('saved-searches/update', {
        body: { id: params.id, name: params.name },
      });
      if (error) throw error;
      const result = data as { ok: boolean; message?: string };
      if (!result?.ok) throw new Error(result?.message || 'Failed to rename');
      return result;
    },
    onSuccess: (_, vars) => {
      toast.success('Renamed');
      queryClient.invalidateQueries({ queryKey: ['saved-searches', vars.module] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to rename');
    },
  });
}

export function useRunSavedSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; module: string }) => {
      const { data, error } = await supabase.functions.invoke('saved-searches/run', {
        body: { id: params.id },
      });
      if (error) throw error;
      const result = data as { ok: boolean; run_id: string; message?: string };
      if (!result?.ok) throw new Error(result?.message || 'Failed to run search');
      return result;
    },
    onSuccess: (result, vars) => {
      toast.success(`Search dispatched — run ${result.run_id?.slice(0, 8)}…`);
      queryClient.invalidateQueries({ queryKey: ['saved-searches', vars.module] });
      queryClient.invalidateQueries({ queryKey: ['search-runs'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to run search');
    },
  });
}

export function useSavedSearchResults(runId: string | null, savedSearchId: string | null) {
  return useQuery({
    queryKey: ['saved-search-results', runId, savedSearchId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        `saved-searches/results?run_id=${runId}&saved_search_id=${savedSearchId}`,
        { method: 'GET' },
      );
      if (error) throw error;
      const result = data as SavedSearchResultsResponse;
      if (!result?.ok) throw new Error('Failed to load results');
      return result;
    },
    enabled: !!runId && !!savedSearchId,
    refetchInterval: 5000, // Poll while waiting for results
  });
}

export function useMarkSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { saved_search_id: string; run_id: string }) => {
      const { data, error } = await supabase.functions.invoke('saved-searches/mark-seen', {
        body: params,
      });
      if (error) throw error;
      const result = data as { ok: boolean; inserted_count: number; message?: string };
      if (!result?.ok) throw new Error(result?.message || 'Failed to mark seen');
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Marked ${result.inserted_count} URLs as seen`);
      queryClient.invalidateQueries({ queryKey: ['saved-search-results'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to mark seen');
    },
  });
}
