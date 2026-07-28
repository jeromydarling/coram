import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useImpulsusCapture } from './useImpulsusCapture';
import { useTestimoniumCapture } from './useTestimoniumCapture';

export interface EmailTaskSuggestion {
  id: string;
  opportunity_id: string;
  email_id: string;
  suggested_title: string;
  suggested_description: string | null;
  suggested_due_date: string | null;
  confidence: number | null;
  extracted_spans: Array<{ excerpt?: string }>;
  status: string;
  created_at: string;
}

export function useEmailTaskSuggestions(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['email-task-suggestions', opportunityId],
    queryFn: async (): Promise<EmailTaskSuggestion[]> => {
      if (!opportunityId) return [];
      const { data, error } = await supabase
        .from('email_task_suggestions')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as EmailTaskSuggestion[];
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAcceptSuggestion() {
  const qc = useQueryClient();
  const { captureImpulsus } = useImpulsusCapture();
  const { captureTestimonium } = useTestimoniumCapture();
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('email-actionitems-accept', {
        body: { suggestion_id: suggestionId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message || 'Failed to accept');
      return { ...res.data, _suggestionId: suggestionId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['email-task-suggestions'] });
      qc.invalidateQueries({ queryKey: ['relationship-actions'] });
      qc.invalidateQueries({ queryKey: ['story-events'] });
      toast.success('Task created from suggestion');

      const taskId = data?.task_id;
      const suggestionId = data._suggestionId;
      captureImpulsus({
        kind: 'task',
        dedupeKey: taskId ? `task:${taskId}` : `task:from-sugg:${suggestionId}`,
        source: { suggestion_id: suggestionId, task_id: taskId },
        context: { taskTitle: data?.task_title },
      });
      captureTestimonium({
        sourceModule: 'email',
        eventKind: 'email_sent',
        summary: 'I accepted an email suggestion.',
        metadata: { suggestion_id: suggestionId, task_id: taskId },
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('email-actionitems-dismiss', {
        body: { suggestion_id: suggestionId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message || 'Failed to dismiss');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-task-suggestions'] });
      toast.success('Suggestion dismissed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
