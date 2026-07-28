import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { Database } from '@/integrations/supabase/types';

type AISuggestion = Database['public']['Tables']['ai_suggestions']['Row'];

// Deterministic ordering for bundle suggestions
const TYPE_ORDER = ['new_opportunity', 'new_contact', 'activity', 'task', 'followup'];

export interface AIBundle {
  source_id: string;
  source: string;
  source_snippet: string | null;
  created_at: string;
  suggestions: AISuggestion[];
}

export interface ApproveBundleRequest {
  source_id: string;
  approvals: Array<{
    suggestion_id: string;
    include: boolean;
  }>;
}

export interface BundleApprovalResult {
  suggestion_id: string;
  status: 'approved' | 'blocked_dependency' | 'failed' | 'skipped';
  created_entity_id?: string;
  created_entity_type?: string;
  error?: string;
}

export interface ApproveBundleResponse {
  success: boolean;
  bundle_execution_id: string;
  source_id: string;
  results: BundleApprovalResult[];
  approved_count: number;
  blocked_count: number;
  failed_count: number;
}

export interface DismissBundleResponse {
  success: boolean;
  source_id: string;
  suggestion_ids: string[];
  dismissed_count: number;
}

function groupBySourceId(suggestions: AISuggestion[]): AIBundle[] {
  const groups: Record<string, AIBundle> = {};
  
  for (const sugg of suggestions) {
    const key = sugg.source_id || sugg.id;
    
    if (!groups[key]) {
      groups[key] = {
        source_id: sugg.source_id || sugg.id,
        source: sugg.source,
        source_snippet: sugg.source_snippet,
        created_at: sugg.created_at || new Date().toISOString(),
        suggestions: [],
      };
    }
    
    groups[key].suggestions.push(sugg);
  }
  
  // Sort suggestions within each bundle by type order
  return Object.values(groups).map(bundle => ({
    ...bundle,
    suggestions: bundle.suggestions.sort((a, b) => 
      TYPE_ORDER.indexOf(a.suggestion_type) - TYPE_ORDER.indexOf(b.suggestion_type)
    ),
  })).sort((a, b) => 
    // Sort bundles by newest first
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function useAIBundles() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ai-bundles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return groupBySourceId(data || []);
    },
    enabled: !!user?.id,
  });
}

async function undoBundleMutationFn(approveResponse: ApproveBundleResponse, queryClient: ReturnType<typeof useQueryClient>) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/profunda-ai?mode=undo-bundle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        bundle_execution_id: approveResponse.bundle_execution_id,
        results: approveResponse.results,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Undo failed');
    }

    const data = await response.json();
    if (data.success) {
      toast.success(`Undone — ${data.undone_count} action${data.undone_count !== 1 ? 's' : ''} reverted`);
      queryClient.invalidateQueries({ queryKey: ['ai-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['email-insights-stats'] });
    } else {
      toast.error('Undo failed');
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Undo failed');
  }
}

export function useApproveBundleMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: ApproveBundleRequest): Promise<ApproveBundleResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/profunda-ai?mode=approve-bundle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Bundle approval failed');
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['email-insights-stats'] });
      
      const { approved_count, blocked_count, failed_count } = data;
      
      if (approved_count > 0 && blocked_count === 0 && failed_count === 0) {
        toast.success(`Approved ${approved_count} action${approved_count > 1 ? 's' : ''}`, {
          action: {
            label: 'Undo',
            onClick: () => {
              undoBundleMutationFn(data, queryClient);
            },
          },
          duration: 8000,
        });
      } else if (approved_count > 0) {
        const issues = [];
        if (blocked_count > 0) issues.push(`${blocked_count} blocked`);
        if (failed_count > 0) issues.push(`${failed_count} failed`);
        toast.warning(`Approved ${approved_count} of ${approved_count + blocked_count + failed_count} (${issues.join(', ')})`, {
          action: {
            label: 'Undo',
            onClick: () => {
              undoBundleMutationFn(data, queryClient);
            },
          },
          duration: 8000,
        });
      } else {
        toast.error('No actions were approved');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to approve bundle');
    },
  });
}

export function useDismissBundleMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (source_id: string): Promise<DismissBundleResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/profunda-ai?mode=dismiss-bundle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ source_id }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Bundle dismiss failed');
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['email-insights-stats'] });
      
      toast.success(`Dismissed ${data.dismissed_count} suggestion${data.dismissed_count > 1 ? 's' : ''}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to dismiss bundle');
    },
  });
}

// Count of pending bundles for badge display
export function usePendingBundleCount() {
  const { data: bundles } = useAIBundles();
  return bundles?.length || 0;
}
