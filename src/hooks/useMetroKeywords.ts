import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

// ── Types ──

export interface MetroKeyword {
  id: string;
  metro_id: string;
  keyword: string;
  category: string;
  weight: number;
  enabled: boolean;
  match_mode: 'phrase' | 'any' | 'all';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalKeyword {
  id: string;
  keyword: string;
  category: string;
  weight: number;
  enabled: boolean;
  match_mode: 'phrase' | 'any' | 'all';
  created_at: string;
  updated_at: string;
}

export interface KeywordSettings {
  metro_id: string;
  use_global_defaults: boolean;
  max_keywords: number;
  radius_miles: number;
}

export const KEYWORD_CATEGORIES = [
  { value: 'need_signals', label: 'Need Signals' },
  { value: 'education', label: 'Education' },
  { value: 'workforce', label: 'Workforce' },
  { value: 'health_services', label: 'Health Services' },
  { value: 'partner_signals', label: 'Partner Signals' },
  { value: 'policy', label: 'Policy' },
  { value: 'local_events', label: 'Local Events' },
  { value: 'tone', label: 'Tone' },
] as const;

// ── Metro Keywords ──

export function useMetroKeywords(metroId: string) {
  return useQuery({
    queryKey: ['metro-keywords', metroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_news_keywords')
        .select('*')
        .eq('metro_id', metroId)
        .order('weight', { ascending: false });
      if (error) throw error;
      return data as MetroKeyword[];
    },
    enabled: !!metroId,
  });
}

export function useAddMetroKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { metro_id: string; keyword: string; category: string; weight?: number; match_mode?: string }) => {
      const { data, error } = await supabase
        .from('metro_news_keywords')
        .insert({
          metro_id: input.metro_id,
          keyword: input.keyword,
          category: input.category,
          weight: input.weight ?? 5,
          match_mode: input.match_mode ?? 'phrase',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['metro-keywords', vars.metro_id] });
      toast.success('Keyword added');
    },
    onError: (e: Error) => toast.error(e.message.includes('duplicate') ? 'Keyword already exists for this metro' : e.message),
  });
}

export function useUpdateMetroKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; metro_id: string; weight?: number; enabled?: boolean; match_mode?: string; category?: string }) => {
      const { id, metro_id, ...updates } = input;
      const { error } = await supabase
        .from('metro_news_keywords')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return { metro_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['metro-keywords', data.metro_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMetroKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; metro_id: string }) => {
      const { error } = await supabase
        .from('metro_news_keywords')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
      return { metro_id: input.metro_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['metro-keywords', data.metro_id] });
      toast.success('Keyword removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Keyword Settings ──

export function useKeywordSettings(metroId: string) {
  return useQuery({
    queryKey: ['keyword-settings', metroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_news_keyword_sets')
        .select('*')
        .eq('metro_id', metroId)
        .maybeSingle();
      if (error) throw error;
      return data as KeywordSettings | null;
    },
    enabled: !!metroId,
  });
}

export function useUpsertKeywordSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { metro_id: string; use_global_defaults: boolean; max_keywords?: number }) => {
      const { error } = await supabase
        .from('metro_news_keyword_sets')
        .upsert({
          metro_id: input.metro_id,
          use_global_defaults: input.use_global_defaults,
          max_keywords: input.max_keywords ?? 40,
        }, { onConflict: 'metro_id' });
      if (error) throw error;
      return { metro_id: input.metro_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['keyword-settings', data.metro_id] });
      toast.success('Keyword settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Global Keywords ──

export function useGlobalKeywords() {
  return useQuery({
    queryKey: ['global-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_news_keywords')
        .select('*')
        .order('weight', { ascending: false });
      if (error) throw error;
      return data as GlobalKeyword[];
    },
  });
}

export function useAddGlobalKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keyword: string; category: string; weight?: number; match_mode?: string }) => {
      const { data, error } = await supabase
        .from('global_news_keywords')
        .insert({
          keyword: input.keyword,
          category: input.category,
          weight: input.weight ?? 5,
          match_mode: input.match_mode ?? 'phrase',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-keywords'] });
      toast.success('Global keyword added');
    },
    onError: (e: Error) => toast.error(e.message.includes('duplicate') ? 'Keyword already exists' : e.message),
  });
}

export function useUpdateGlobalKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; weight?: number; enabled?: boolean; match_mode?: string; category?: string }) => {
      const { id, ...updates } = input;
      const { error } = await supabase
        .from('global_news_keywords')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-keywords'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGlobalKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('global_news_keywords')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-keywords'] });
      toast.success('Global keyword removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
