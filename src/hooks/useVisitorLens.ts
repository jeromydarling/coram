/**
 * useVisitorLens — Per-user-per-tenant "Visitor mode" toggle.
 *
 * WHAT: Reads/writes tenant_user_preferences.ui_lens to let higher-role users
 *       switch into a simplified Visitor UI experience.
 * WHERE: Consumed by Sidebar, Header avatar menu, and routing guards.
 * WHY: Purely a UI lens toggle — does NOT change RLS permissions or backend roles.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';

const LAST_FULL_ROUTE_KEY = 'cros-last-full-route';

function getLastFullRoute(tenantId: string): string | null {
  try {
    const stored = localStorage.getItem(`${LAST_FULL_ROUTE_KEY}-${tenantId}`);
    return stored;
  } catch {
    return null;
  }
}

function setLastFullRoute(tenantId: string, path: string) {
  try {
    localStorage.setItem(`${LAST_FULL_ROUTE_KEY}-${tenantId}`, path);
  } catch {
    // localStorage unavailable
  }
}

export function useVisitorLens() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  const queryKey = ['tenant-user-preferences', tenant?.id, user?.id];

  const { data: prefs, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return null;
      const { data } = await supabase
        .from('tenant_user_preferences' as any)
        .select('ui_lens')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return data as unknown as { ui_lens: string } | null;
    },
    enabled: !!tenant?.id && !!user?.id,
  });

  const isVisitorMode = prefs?.ui_lens === 'visitor';

  const toggleMutation = useMutation({
    mutationFn: async (newLens: 'default' | 'visitor') => {
      if (!tenant?.id || !user?.id) throw new Error('Missing tenant/user');

      const { error } = await supabase
        .from('tenant_user_preferences' as any)
        .upsert(
          { tenant_id: tenant.id, user_id: user.id, ui_lens: newLens },
          { onConflict: 'tenant_id,user_id' }
        );
      if (error) throw error;
      return newLens;
    },
    onMutate: async (newLens) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, { ui_lens: newLens });
      return { prev };
    },
    onError: (_err, _newLens, context) => {
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleVisitorMode = () => {
    if (isVisitorMode) {
      // Exiting visitor mode → navigate to last full route or dashboard
      const lastRoute = tenant?.id ? getLastFullRoute(tenant.id) : null;
      toggleMutation.mutate('default', {
        onSuccess: () => {
          navigate(lastRoute || tenantPath('/'));
        },
      });
    } else {
      // Entering visitor mode → save current route, navigate to /visits
      if (tenant?.id) {
        setLastFullRoute(tenant.id, window.location.pathname);
      }
      toggleMutation.mutate('visitor', {
        onSuccess: () => {
          navigate(tenantPath('/visits'));
        },
      });
    }
  };

  return {
    isVisitorMode,
    isLoading,
    toggleVisitorMode,
    isToggling: toggleMutation.isPending,
  };
}
