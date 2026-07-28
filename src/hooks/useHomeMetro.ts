import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export function useHomeMetro() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['home-metro', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('home_metro_id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return (data as any)?.home_metro_id as string | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  return query;
}

export function useSetHomeMetro() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (metroId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update({ home_metro_id: metroId } as any)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-metro'] });
      toast.success('Home metro set');
    },
    onError: (err) => toast.error(`Failed to set home metro: ${err.message}`),
  });
}
