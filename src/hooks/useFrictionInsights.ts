/**
 * useFrictionInsights — React Query hooks for NRI Friction Insight Engine.
 *
 * WHAT: Hooks for reading/updating design suggestions and playbook drafts.
 * WHERE: Operator Nexus pages (Signum, Knowledge).
 * WHY: Cleanly separates data access from UI for friction intelligence.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface DesignSuggestion {
  id: string;
  tenant_id: string | null;
  pattern_key: string;
  created_at: string;
  severity: 'low' | 'medium' | 'high';
  suggestion_summary: string;
  narrative_detail: string;
  affected_routes: string[];
  roles_affected: string[];
  evidence: Record<string, unknown>;
  status: 'open' | 'reviewed' | 'implemented' | 'dismissed';
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface PlaybookDraft {
  id: string;
  tenant_id: string | null;
  pattern_key: string;
  created_at: string;
  title: string;
  role: string | null;
  related_feature_key: string | null;
  draft_markdown: string;
  evidence: Record<string, unknown>;
  status: 'draft' | 'published' | 'dismissed';
  published_at: string | null;
  published_by: string | null;
}

export function useDesignSuggestions(filters?: { status?: string; severity?: string }) {
  return useQuery({
    queryKey: ['nri-design-suggestions', filters],
    queryFn: async () => {
      let query = supabase
        .from('nri_design_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.severity && filters.severity !== 'all') {
        query = query.eq('severity', filters.severity);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DesignSuggestion[];
    },
  });
}

export function usePlaybookDrafts(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['nri-playbook-drafts', filters],
    queryFn: async () => {
      let query = supabase
        .from('nri_playbook_drafts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PlaybookDraft[];
    },
  });
}

export function useUpdateDesignSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'reviewed' || status === 'implemented' || status === 'dismissed') {
        const { data: { user } } = await supabase.auth.getUser();
        updates.reviewed_at = new Date().toISOString();
        updates.reviewed_by = user?.id;
      }
      const { error } = await supabase
        .from('nri_design_suggestions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nri-design-suggestions'] });
      toast.success('Suggestion updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePlaybookDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, draft_markdown }: { id: string; status: string; draft_markdown?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'published') {
        const { data: { user } } = await supabase.auth.getUser();
        updates.published_at = new Date().toISOString();
        updates.published_by = user?.id;
      }
      if (draft_markdown !== undefined) updates.draft_markdown = draft_markdown;
      const { error } = await supabase
        .from('nri_playbook_drafts')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nri-playbook-drafts'] });
      toast.success('Playbook draft updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRunFrictionInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { scope?: string; tenant_id?: string; since_hours?: number }) => {
      const { data, error } = await supabase.functions.invoke('nri-friction-insights', {
        body: params ?? {},
      });
      if (error) throw error;
      if (data && !data.ok) throw new Error(data.reason || data.error || 'Unknown error');
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['nri-design-suggestions'] });
      qc.invalidateQueries({ queryKey: ['nri-playbook-drafts'] });
      const total = (data.design_suggestions ?? 0) + (data.playbook_drafts ?? 0);
      if (total === 0) {
        toast.info(
          'No UI-related patterns found. Friction events may be system-level — check System → Friction for details.',
          { duration: 6000 }
        );
      } else {
        const msg = `Found ${data.design_suggestions} design suggestions and ${data.playbook_drafts} playbook drafts`;
        toast.success(msg);
      }
    },
    onError: (e: Error) => {
      if (e.message === 'cooldown_active') {
        toast.info('Friction insights ran recently — try again later.');
      } else {
        toast.error(e.message);
      }
    },
  });
}
