/**
 * FocusTenantPicker — Pin a "Focus Tenant" for expanded awareness.
 *
 * WHAT: Dropdown to select a pinned tenant for concentrated operator attention.
 * WHERE: Operator Nexus top bar.
 * WHY: Allows operators to focus their attention on a specific community.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pin, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export function FocusTenantPicker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tenants } = useQuery({
    queryKey: ['focus-tenants-list'],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('id, name, slug').order('name');
      return data || [];
    },
  });

  const { data: focusTenant } = useQuery({
    queryKey: ['operator-focus-tenant', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('operator_focus_tenant' as any)
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as any)?.tenant_id || null;
    },
    enabled: !!user?.id,
  });

  const setFocus = useMutation({
    mutationFn: async (tenantId: string | null) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (tenantId) {
        const { error } = await supabase
          .from('operator_focus_tenant' as any)
          .upsert({ user_id: user.id, tenant_id: tenantId } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('operator_focus_tenant' as any)
          .delete()
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-focus-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['operator-awareness-events'] });
    },
    onError: (err) => toast.error(String(err)),
  });

  const focusTenantName = tenants?.find(t => t.id === focusTenant)?.name;

  return (
    <div className="flex items-center gap-2">
      {focusTenant && focusTenantName ? (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs gap-1 font-normal">
            <Pin className="w-2.5 h-2.5" />
            {focusTenantName}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setFocus.mutate(null)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) setFocus.mutate(e.target.value);
          }}
          className="h-7 text-xs rounded-md border border-input bg-background px-2 py-0.5 text-muted-foreground"
        >
          <option value="">Pin a focus tenant...</option>
          {tenants?.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
