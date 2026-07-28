/**
 * useFederatedApps — Loads the federation app registry from the database.
 *
 * WHAT: Returns active rows from federated_apps_active view.
 * WHERE: Used by useFederationScope and FederationAppSwitcher.
 * WHY:  Adding/removing an app is a DB row, not a code change. This hook is the read.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FederatedApp } from '@/lib/federation/scope';

export function useFederatedApps() {
  return useQuery<FederatedApp[]>({
    queryKey: ['federated-apps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('federated_apps_active')
        .select('source_app, display_name, accent_color, public_base_url, display_order')
        .order('display_order', { ascending: true });
      if (error) {
        // If federated_apps_active doesn't exist yet (migration not applied), fail soft
        // and return a single 'thecros' entry so the UI doesn't break.
        // eslint-disable-next-line no-console
        console.warn('[useFederatedApps] view not available, falling back to hub-only:', error.message);
        return [
          {
            source_app: 'thecros',
            display_name: 'The CROS',
            description: 'The federation hub',
            accent_color: '#0f766e',
            public_base_url: null,
            is_hub: true,
            display_order: 10,
          },
        ];
      }
      return (data ?? []).map((row: any) => ({
        source_app: row.source_app,
        display_name: row.display_name,
        description: null,
        accent_color: row.accent_color,
        public_base_url: row.public_base_url,
        is_hub: row.source_app === 'thecros',
        display_order: row.display_order,
      })) as FederatedApp[];
    },
    staleTime: 5 * 60_000, // app registry rarely changes
    refetchOnWindowFocus: false,
  });
}
