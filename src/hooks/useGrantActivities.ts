import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export type GrantActivityType = 'Research' | 'Call' | 'Meeting' | 'Writing' | 'Submission' | 'Reporting';

export interface GrantActivity {
  id: string;
  activity_id: string;
  grant_id: string;
  activity_type: GrantActivityType;
  activity_date: string;
  notes: string | null;
  next_action: string | null;
  next_action_due: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrantActivityInput {
  grant_id: string;
  activity_type: GrantActivityType;
  activity_date: string;
  notes?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  owner_id?: string | null;
}

function generateActivityId(): string {
  return 'GA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function useGrantActivities(grantId: string | null) {
  return useQuery({
    queryKey: ['grant-activities', grantId],
    queryFn: async () => {
      if (!grantId) return [];
      
      const { data, error } = await supabase
        .from('grant_activities')
        .select('*')
        .eq('grant_id', grantId)
        .order('activity_date', { ascending: false });
      
      if (error) throw error;
      return data as GrantActivity[];
    },
    enabled: !!grantId
  });
}

export function useCreateGrantActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: GrantActivityInput) => {
      const { data, error } = await supabase
        .from('grant_activities')
        .insert({
          ...input,
          activity_id: generateActivityId()
        } as never)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grant-activities', variables.grant_id] });
      toast.success('Activity logged successfully');
    },
    onError: (error) => {
      toast.error(`Failed to log activity: ${error.message}`);
    }
  });
}

export function useUpdateGrantActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, grant_id, ...input }: Partial<GrantActivityInput> & { id: string; grant_id: string }) => {
      const { data, error } = await supabase
        .from('grant_activities')
        .update(input as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grant-activities', variables.grant_id] });
      toast.success('Activity updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update activity: ${error.message}`);
    }
  });
}

export function useDeleteGrantActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, grant_id }: { id: string; grant_id: string }) => {
      const { error } = await supabase
        .from('grant_activities')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grant-activities', variables.grant_id] });
      toast.success('Activity deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete activity: ${error.message}`);
    }
  });
}
