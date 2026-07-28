/**
 * useProjectImpact — CRUD for activity_impact snapshots on Projects.
 *
 * WHAT: Reads/writes people_helped, attendance_count, outcome_note for a project.
 * WHERE: ProjectDetail impact card.
 * WHY: Lightweight impact capture feeds Testimonium rollups and NRI signals.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface ProjectImpact {
  activity_id: string;
  tenant_id: string;
  people_helped: number | null;
  attendance_count: number | null;
  outcome_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjectImpact(activityId: string | undefined) {
  return useQuery({
    queryKey: ['project-impact', activityId],
    enabled: !!activityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_impact')
        .select('*')
        .eq('activity_id', activityId!)
        .maybeSingle();
      if (error) throw error;
      return data as ProjectImpact | null;
    },
  });
}

export function useSaveProjectImpact() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      activityId: string;
      peopleHelped?: number | null;
      attendanceCount?: number | null;
      outcomeNote?: string | null;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Missing tenant or user');

      const { data, error } = await supabase
        .from('activity_impact')
        .upsert({
          activity_id: input.activityId,
          tenant_id: tenantId,
          people_helped: input.peopleHelped ?? null,
          attendance_count: input.attendanceCount ?? null,
          outcome_note: input.outcomeNote ?? null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'activity_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-impact', vars.activityId] });
      toast.success('Impact saved');
    },
    onError: (error: Error) => {
      toast.error(`Could not save impact: ${error.message}`);
    },
  });
}
