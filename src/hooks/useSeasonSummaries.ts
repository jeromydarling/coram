/**
 * useSeasonSummaries — Hooks for season summary CRUD.
 *
 * WHAT: Fetches and manages season summaries for a contact/person.
 * WHERE: PersonDetail, CareCompletionDialog.
 * WHY: Caregivers need versioned, narrative summaries of care seasons.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface SeasonSummary {
  id: string;
  tenant_id: string;
  contact_id: string;
  created_by: string | null;
  version: number;
  date_range_start: string;
  date_range_end: string;
  care_log_count: number;
  total_hours: number | null;
  themes: string | null;
  excerpts: string | null;
  gratitude_line: string | null;
  visibility: 'private' | 'shared' | 'exported';
  published_at: string | null;
  created_at: string;
}

export function useSeasonSummaries(contactId: string | null) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['season-summaries', tenantId, contactId],
    enabled: !!tenantId && !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_summaries')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('contact_id', contactId!)
        .order('version', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SeasonSummary[];
    },
  });
}

export function useCreateSeasonSummary() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      contact_id: string;
      date_range_start: string;
      date_range_end: string;
      care_log_count: number;
      total_hours?: number;
      themes?: string;
      excerpts?: string;
      gratitude_line?: string;
      visibility?: string;
    }) => {
      // Get next version
      const { data: existing } = await supabase
        .from('season_summaries')
        .select('version')
        .eq('tenant_id', tenantId!)
        .eq('contact_id', input.contact_id)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version ?? 0) + 1;

      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('season_summaries')
        .insert({
          tenant_id: tenantId!,
          contact_id: input.contact_id,
          created_by: user.user?.id ?? null,
          version: nextVersion,
          date_range_start: input.date_range_start,
          date_range_end: input.date_range_end,
          care_log_count: input.care_log_count,
          total_hours: input.total_hours ?? null,
          themes: input.themes ?? null,
          excerpts: input.excerpts ?? null,
          gratitude_line: input.gratitude_line ?? null,
          visibility: input.visibility ?? 'private',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['season-summaries', tenantId, vars.contact_id] });
    },
  });
}
