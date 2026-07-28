import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LookupItem {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export function useEventTypes() {
  return useQuery({
    queryKey: ['event-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as LookupItem[];
    }
  });
}

export function useEventTargetPopulations() {
  return useQuery({
    queryKey: ['event-target-populations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_target_populations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as LookupItem[];
    }
  });
}

export function useEventStrategicLanes() {
  return useQuery({
    queryKey: ['event-strategic-lanes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_strategic_lanes')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as LookupItem[];
    }
  });
}

export function useEventPcsGoals() {
  return useQuery({
    queryKey: ['event-pcs-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_pcs_goals')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as LookupItem[];
    }
  });
}
