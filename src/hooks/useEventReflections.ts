import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRow } from '@/lib/supabaseRow';

export interface EventReflection {
  id: string;
  event_id: string;
  opportunity_id: string | null;
  author_id: string;
  body: string;
  visibility: 'private' | 'team';
  created_at: string;
  updated_at: string;
  author_name?: string;
}

export interface EventReflectionExtraction {
  id: string;
  reflection_id: string;
  topics: string[];
  signals: Array<{ type: string; value?: string }>;
  partner_mentions: string[];
  summary_safe: string;
  model: string | null;
  created_at: string;
}

export function useEventReflections(eventId: string | null) {
  return useQuery({
    queryKey: queryKeys.events.reflections(eventId ?? ''),
    queryFn: async (): Promise<EventReflection[]> => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('event_reflections')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author names
      const rows = (data || []) as Array<{ author_id: string } & Record<string, unknown>>;
      const authorIds = [...new Set(rows.map((r) => r.author_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', authorIds);
        profilesMap = (profiles || []).reduce((acc: Record<string, string>, p) => {
          acc[p.user_id] = p.display_name || 'Team member';
          return acc;
        }, {});
      }

      return rows.map((r) => ({
        ...supabaseRow<EventReflection>(r),
        visibility: (r.visibility as 'private' | 'team'),
        author_name: profilesMap[r.author_id] || 'Team member',
      }));
    },
    enabled: !!eventId,
  });
}

export function useAddEventReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, body, visibility = 'team', opportunityId }: {
      eventId: string;
      body: string;
      visibility?: 'private' | 'team';
      opportunityId?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('event_reflections')
        .insert({
          event_id: eventId,
          author_id: user.id,
          body,
          visibility,
          opportunity_id: opportunityId || null,
        })
        .select()
        .single();

      if (error) throw error;

      const inserted = supabaseRow<{ id: string }>(data);

      // Fire-and-forget extraction
      supabase.functions.invoke('event-reflection-extract', {
        body: { reflection_id: inserted.id },
      }).catch(() => {});

      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.reflections(vars.eventId) });
      toast.success('Reflection added');
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });
}

export function useUpdateEventReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body, visibility, eventId, opportunityId }: {
      id: string;
      body: string;
      visibility?: 'private' | 'team';
      eventId: string;
      opportunityId?: string | null;
    }) => {
      const update: Record<string, unknown> = { body };
      if (visibility) update.visibility = visibility;
      if (opportunityId !== undefined) update.opportunity_id = opportunityId || null;
      const { error } = await supabase
        .from('event_reflections')
        .update(update)
        .eq('id', id);
      if (error) throw error;

      // Re-extract after update
      supabase.functions.invoke('event-reflection-extract', {
        body: { reflection_id: id },
      }).catch(() => {});
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.reflections(vars.eventId) });
      toast.success('Reflection updated');
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });
}

export function useDeleteEventReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase
        .from('event_reflections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.reflections(vars.eventId) });
      toast.success('Reflection removed');
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });
}
