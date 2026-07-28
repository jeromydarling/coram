import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { useImpulsusCapture } from './useImpulsusCapture';

export interface AISuggestion {
  id: string;
  user_id: string;
  source: 'chat' | 'email_analysis' | 'ocr';
  source_id: string | null;
  source_snippet: string | null;
  suggestion_type: 'new_contact' | 'new_opportunity' | 'task' | 'followup' | 'stage_change';
  status: 'pending' | 'processing' | 'approved' | 'dismissed' | 'auto_approved' | 'failed';
  suggested_name: string | null;
  suggested_email: string | null;
  suggested_phone: string | null;
  suggested_title: string | null;
  suggested_organization: string | null;
  task_title: string | null;
  task_description: string | null;
  task_due_date: string | null;
  followup_reason: string | null;
  confidence_score: number | null;
  ai_reasoning: string | null;
  sender_email: string | null;
  created_at: string;
  updated_at: string;
  created_entity_id: string | null;
  created_entity_type: string | null;
  linked_contact_id: string | null;
  // Joined data for task context
  linked_contact?: {
    id: string;
    name: string;
    opportunity_id: string | null;
    opportunities?: {
      id: string;
      organization: string;
    } | null;
  } | null;
}

interface UseAISuggestionsOptions {
  source?: string;
  status?: string | string[];
  limit?: number;
}

export function useAISuggestions(options: UseAISuggestionsOptions = {}) {
  const { user } = useAuth();
  // [RULE 12] Server-side clamp to max 50
  const limit = Math.min(options.limit || 50, 50);
  
  return useInfiniteQuery({
    queryKey: ['ai-suggestions', user?.id, options],
    queryFn: async ({ pageParam }) => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('ai_suggestions')
        .select(`
          *,
          linked_contact:contacts!ai_suggestions_linked_contact_id_fkey (
            id,
            name,
            opportunity_id,
            opportunities!contacts_opportunity_id_fkey (
              id,
              organization
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (options.source) {
        query = query.eq('source', options.source);
      }
      
      if (Array.isArray(options.status)) {
        query = query.in('status', options.status);
      } else if (options.status) {
        query = query.eq('status', options.status);
      }
      
      // Cursor-based pagination
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AISuggestion[];
    },
    getNextPageParam: (lastPage) =>
      lastPage?.length === limit ? lastPage[lastPage.length - 1].created_at : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!user?.id,
  });
}

export function useApproveSuggestion() {
  const queryClient = useQueryClient();
  const { captureImpulsus } = useImpulsusCapture();
  
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profunda-ai?mode=approve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ suggestionId, approvalMode: 'single' }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Approval failed');
      }
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Approval failed');
      
      return { ...data, _suggestionId: suggestionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Created ${data.created_entity_type || 'entity'} successfully`);

      captureImpulsus({
        kind: 'ai_suggestion',
        dedupeKey: `sugg:${data._suggestionId}`,
        source: { suggestion_id: data._suggestionId, entity_type: data.created_entity_type },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve suggestion');
    },
  });
}

export function useBulkApproveSuggestions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (suggestionIds: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profunda-ai?mode=approve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ suggestionIds, approvalMode: 'bulk' }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Bulk approval failed');
      }
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Bulk approval failed');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Approved ${data.approved} suggestions (threshold: ${Math.round(data.threshold_used * 100)}%)`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to bulk approve');
    },
  });
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (suggestionId: string | string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const body = Array.isArray(suggestionId)
        ? { suggestionIds: suggestionId }
        : { suggestionId };
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profunda-ai?mode=dismiss`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Dismiss failed');
      }
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Dismiss failed');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      toast.success('Suggestion dismissed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to dismiss suggestion');
    },
  });
}
