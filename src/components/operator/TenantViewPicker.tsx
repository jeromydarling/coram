/**
 * TenantViewPicker — Gardener tool to preview the app as any demo tenant.
 *
 * WHAT: Dropdown selector that overrides the TenantContext for preview.
 * WHERE: Gardener Console sidebar or toolbar.
 * WHY: Allows gardeners to see exactly what a tenant user sees without impersonation.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function TenantViewPicker() {
  const { isAdmin } = useAuth();
  const { viewingAsTenant, setViewingAsTenantId } = useTenant();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const toggle = () => setHidden(h => !h);
    window.addEventListener('toggle-tenant-banner', toggle);
    return () => window.removeEventListener('toggle-tenant-banner', toggle);
  }, []);

  const { data: demoTenants } = useQuery({
    queryKey: ['demo-tenants-for-view'],
    enabled: isAdmin && !hidden,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demo_tenants')
        .select('id, name, slug, tenant_id, seed_profile')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  if (hidden || !isAdmin) return null;

  return (
    <div className="px-3 py-3 border-t border-border space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <Eye className="h-3.5 w-3.5" />
        View as Tenant
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Preview the app exactly as a demo tenant would see it.<br />
                <strong>Where:</strong> Affects all navigation, features, and data visibility.<br />
                <strong>Why:</strong> For screenshots, QA, and understanding tenant experience.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Select
        value={viewingAsTenant?.id ?? '__none'}
        onValueChange={(v) => setViewingAsTenantId(v === '__none' ? null : v)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select demo tenant…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— My Account —</SelectItem>
          {demoTenants?.map((dt) => (
            <SelectItem key={dt.id} value={dt.tenant_id ?? dt.id}>
              {dt.name} ({dt.seed_profile})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
