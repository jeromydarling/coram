import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, addDays, format } from 'date-fns';
import { toast } from '@/components/ui/sonner';

export interface GoogleEventWithHidden {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  description: string | null;
  hidden: boolean;
}

export function useWeeklyGoogleEvents() {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const weekEnd = endOfDay(addDays(today, 6));

  return useQuery({
    queryKey: ['weekly-google-events-all', format(today, 'yyyy-MM-dd'), user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('google_calendar_events')
        .select('id, title, start_time, end_time, location, description, hidden')
        .eq('user_id', user.id)
        .gte('start_time', today.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as GoogleEventWithHidden[];
    },
    enabled: !!user?.id,
  });
}

export function useToggleGoogleEventHidden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase
        .from('google_calendar_events')
        .update({ hidden })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-google-events-all'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['command-center'] });
    },
    onError: () => {
      toast.error('Failed to update event visibility');
    },
  });
}
