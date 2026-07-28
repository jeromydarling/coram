/**
 * useImpulsusSettings — settings query + idempotent upsert.
 *
 * WHAT: Fetches and mutates the user's Impulsus capture preferences.
 * WHERE: Used on the Impulsus page and by the capture hook.
 * WHY: Lets users toggle which capture kinds are active.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ImpulsusSettings {
  user_id: string;
  visibility: string;
  capture_email_actions: boolean;
  capture_calendar_events: boolean;
  capture_ai_suggestions: boolean;
  capture_reflections: boolean;
}

const DEFAULT_SETTINGS: Omit<ImpulsusSettings, 'user_id'> = {
  visibility: 'private',
  capture_email_actions: true,
  capture_calendar_events: true,
  capture_ai_suggestions: true,
  capture_reflections: true,
};

export function useImpulsusSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['impulsus-settings', user?.id],
    queryFn: async (): Promise<ImpulsusSettings | null> => {
      if (!user?.id) return null;

      // Idempotent upsert — creates row if missing, does nothing if exists
      await supabase
        .from('impulsus_settings')
        .upsert(
          {
            user_id: user.id,
            visibility: 'private',
            capture_email_actions: true,
            capture_calendar_events: true,
            capture_ai_suggestions: true,
            capture_reflections: true,
          },
          { onConflict: 'user_id', ignoreDuplicates: true },
        );

      const { data, error } = await supabase
        .from('impulsus_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data as ImpulsusSettings;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<Omit<ImpulsusSettings, 'user_id' | 'visibility'>>) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('impulsus_settings')
        .update(updates)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impulsus-settings'] });
    },
  });

  const settings: ImpulsusSettings | null = query.data ?? (user?.id
    ? { user_id: user.id, ...DEFAULT_SETTINGS }
    : null);

  return { settings, isLoading: query.isLoading, updateSettings };
}
