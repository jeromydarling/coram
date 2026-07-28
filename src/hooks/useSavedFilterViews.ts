/**
 * useSavedFilterViews — CRUD for per-user persistent filter views.
 *
 * WHAT: Manages saved filter presets per entity type.
 * WHERE: Used in contacts, opportunities, and any filtered list page.
 * WHY: Users need to quickly switch between common filter combinations.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface SavedFilterView {
  id: string;
  view_name: string;
  entity_type: string;
  filters: Record<string, unknown>;
  sort_config: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
}

export function useSavedFilterViews(entityType: string) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const queryKey = ['saved-filter-views', entityType, user?.id];

  const views = useQuery<SavedFilterView[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_filter_views' as any)
        .select('*')
        .eq('user_id', user!.id)
        .eq('entity_type', entityType)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SavedFilterView[];
    },
    enabled: !!user?.id,
  });

  const saveView = useMutation({
    mutationFn: async (params: {
      view_name: string;
      filters: Record<string, unknown>;
      sort_config?: Record<string, unknown>;
      is_default?: boolean;
    }) => {
      // If setting as default, unset existing default first
      if (params.is_default) {
        await supabase
          .from('saved_filter_views' as any)
          .update({ is_default: false } as any)
          .eq('user_id', user!.id)
          .eq('entity_type', entityType)
          .eq('is_default', true);
      }

      const { error } = await supabase.from('saved_filter_views' as any).insert({
        user_id: user!.id,
        tenant_id: tenantId,
        entity_type: entityType,
        view_name: params.view_name,
        filters: params.filters,
        sort_config: params.sort_config ?? {},
        is_default: params.is_default ?? false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Filter view saved.');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Could not save filter view.'),
  });

  const deleteView = useMutation({
    mutationFn: async (viewId: string) => {
      const { error } = await supabase
        .from('saved_filter_views' as any)
        .delete()
        .eq('id', viewId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Filter view removed.');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Could not remove filter view.'),
  });

  const defaultView = views.data?.find((v) => v.is_default) ?? null;

  return {
    views: views.data ?? [],
    isLoading: views.isLoading,
    defaultView,
    saveView,
    deleteView,
  };
}
