import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { AIBundle, ApproveBundleRequest, ApproveBundleResponse } from './useAIBundles';

/**
 * Approve every pending suggestion across all bundles in a single sweep.
 * Calls approve-bundle per source_id sequentially to respect dependency ordering.
 */
export function useApproveAllBundlesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bundles: AIBundle[]): Promise<{ total: number; approved: number; failed: number }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      let totalApproved = 0;
      let totalFailed = 0;

      for (const bundle of bundles) {
        const request: ApproveBundleRequest = {
          source_id: bundle.source_id,
          approvals: bundle.suggestions.map(s => ({
            suggestion_id: s.id,
            include: true,
          })),
        };

        const response = await fetch(`${supabaseUrl}/functions/v1/profunda-ai?mode=approve-bundle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
        });

        if (response.ok) {
          const data: ApproveBundleResponse = await response.json();
          totalApproved += data.approved_count;
          totalFailed += data.failed_count + data.blocked_count;
        } else {
          totalFailed += bundle.suggestions.length;
        }
      }

      return {
        total: bundles.reduce((sum, b) => sum + b.suggestions.length, 0),
        approved: totalApproved,
        failed: totalFailed,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['email-insights-stats'] });

      if (data.failed === 0) {
        toast.success(`Approved all ${data.approved} suggestion${data.approved !== 1 ? 's' : ''}`);
      } else {
        toast.warning(`Approved ${data.approved} of ${data.total} (${data.failed} failed)`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to approve all');
    },
  });
}
