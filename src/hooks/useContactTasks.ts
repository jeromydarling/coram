import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface ContactTask {
  id: string;
  contact_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export function useContactTasks(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-tasks', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('contact_tasks')
        .select('*')
        .eq('contact_id', contactId)
        .order('is_completed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContactTask[];
    },
    enabled: !!contactId
  });
}

export function useCreateContactTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (task: {
      contact_id: string;
      title: string;
      description?: string;
      due_date?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('contact_tasks')
        .insert({
          ...task,
          created_by: user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', data.contact_id] });
      toast.success('Task created');
    },
    onError: (error) => {
      toast.error(`Failed to create task: ${error.message}`);
    }
  });
}

export function useUpdateContactTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, contact_id, ...updates }: {
      id: string;
      contact_id: string;
      title?: string;
      description?: string | null;
      due_date?: string | null;
      is_completed?: boolean;
      completed_at?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('contact_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { data, contact_id };
    },
    onSuccess: ({ contact_id }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', contact_id] });
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`);
    }
  });
}

export function useToggleContactTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, contact_id, is_completed, task_title }: {
      id: string;
      contact_id: string;
      is_completed: boolean;
      task_title?: string;
    }) => {
      const { data, error } = await supabase
        .from('contact_tasks')
        .update({
          is_completed,
          completed_at: is_completed ? new Date().toISOString() : null
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // If task is being marked complete, auto-dismiss any related overdue alerts
      if (is_completed) {
        await supabase
          .from('user_alerts')
          .update({ read_at: new Date().toISOString() })
          .eq('ref_id', id)
          .eq('ref_type', 'contact_task')
          .is('read_at', null);
      }
      
      // If task is being marked complete, create/update an activity record
      // Use task ID for idempotency - prevents duplicates on re-completion
      if (is_completed && task_title) {
        const activityId = `TASK-${id}`;
        
        // Check if activity already exists for this task
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('activity_id', activityId)
          .maybeSingle();
        
        if (existing) {
          // Update existing activity timestamp
          await supabase
            .from('activities')
            .update({
              activity_date_time: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Create new activity
          await supabase
            .from('activities')
            .insert({
              activity_id: activityId,
              activity_type: 'Other',
              activity_date_time: new Date().toISOString(),
              contact_id: contact_id,
              notes: `Task completed: ${task_title}`,
              outcome: 'Connected'
            });
        }
      }
      
      return { data, contact_id };
    },
    onSuccess: ({ data, contact_id }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', contact_id] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['unified-activities'] });
      queryClient.invalidateQueries({ queryKey: ['user-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['user-alerts-count'] });
      toast.success(data.is_completed ? 'Task completed' : 'Task reopened');
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`);
    }
  });
}

export function useDeleteContactTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, contact_id }: { id: string; contact_id: string }) => {
      const { error } = await supabase
        .from('contact_tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { contact_id };
    },
    onSuccess: ({ contact_id }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', contact_id] });
      toast.success('Task deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    }
  });
}
