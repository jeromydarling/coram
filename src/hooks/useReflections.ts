import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { crosToast } from '@/lib/crosToast';
import { handleMutationError } from '@/lib/permissionErrors';
import { useImpulsusCapture } from './useImpulsusCapture';

export interface Reflection {
  id: string;
  opportunity_id: string;
  author_id: string;
  body: string;
  visibility: 'private' | 'team';
  created_at: string;
  updated_at: string;
  author_name?: string;
}

export function useReflections(opportunityId: string | null) {
  return useQuery({
    queryKey: ['reflections', opportunityId],
    queryFn: async (): Promise<Reflection[]> => {
      if (!opportunityId) return [];

      const { data, error } = await supabase
        .from('opportunity_reflections')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author names
      const authorIds = [...new Set((data || []).map(r => r.author_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, display_name')
          .in('user_id', authorIds);
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.display_name || 'Team member';
          return acc;
        }, {} as Record<string, string>);
      }

      return (data || []).map(r => ({
        ...r,
        visibility: r.visibility as 'private' | 'team',
        author_name: profilesMap[r.author_id] || 'Team member',
      }));
    },
    enabled: !!opportunityId,
  });
}

export function useAddReflection() {
  const queryClient = useQueryClient();
  const { captureImpulsus } = useImpulsusCapture();
  return useMutation({
    mutationFn: async ({ opportunityId, body, visibility = 'team', followUpDate }: {
      opportunityId: string;
      body: string;
      visibility?: 'private' | 'team';
      followUpDate?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const insertPayload: Record<string, unknown> = {
        opportunity_id: opportunityId,
        author_id: user.id,
        body,
        visibility,
      };
      if (followUpDate) {
        insertPayload.follow_up_date = followUpDate;
      }

      const { data, error } = await supabase
        .from('opportunity_reflections')
        .insert(insertPayload as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['reflections', vars.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['story-events', vars.opportunityId] });
      crosToast.held();

      captureImpulsus({
        kind: 'reflection',
        opportunityId: vars.opportunityId,
        dedupeKey: `refl:${data.id}`,
        source: { reflection_id: data.id },
        context: { reflectionSnippet: vars.body?.slice(0, 80) },
      });
    },
    onError: (error) => handleMutationError(error, () => crosToast.gentle(`Something didn't go through: ${error.message}`)),
  });
}

export function useUpdateReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body, visibility, opportunityId }: {
      id: string;
      body: string;
      visibility?: 'private' | 'team';
      opportunityId: string;
    }) => {
      const update: Record<string, string> = { body };
      if (visibility) update.visibility = visibility;
      const { error } = await supabase
        .from('opportunity_reflections')
        .update(update)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['reflections', vars.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['story-events', vars.opportunityId] });
      crosToast.updated();
    },
    onError: (error) => handleMutationError(error, () => crosToast.gentle(`Something didn't go through: ${error.message}`)),
  });
}

export function useDeleteReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, opportunityId }: { id: string; opportunityId: string }) => {
      const { error } = await supabase
        .from('opportunity_reflections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['reflections', vars.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['story-events', vars.opportunityId] });
      crosToast.removed();
    },
    onError: (error) => handleMutationError(error, () => crosToast.gentle(`Something didn't go through: ${error.message}`)),
  });
}
