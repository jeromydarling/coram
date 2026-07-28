/**
 * ExpansionMomentBanner — Gentle NRI banner for expansion moments.
 *
 * WHAT: Shows a warm, non-blocking banner when an unacknowledged expansion moment exists.
 * WHERE: Dashboard or main layout area.
 * WHY: Surfaces organic growth awareness without upsell pressure.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';

export function ExpansionMomentBanner() {
  const { tenant } = useTenant();
  const tenantId = (tenant as any)?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  const { data: moment } = useQuery({
    queryKey: ['expansion-moment-banner', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('expansion_moments')
        .select('id, score')
        .eq('tenant_id', tenantId)
        .eq('acknowledged', false)
        .order('detected_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const dismiss = useMutation({
    mutationFn: async (momentId: string) => {
      const { error } = await supabase
        .from('expansion_moments')
        .update({ acknowledged: true })
        .eq('id', momentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expansion-moment-banner'] });
    },
  });

  if (!moment) return null;

  return (
    <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
      <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
          Your relationships are beginning to grow beyond one community.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          This is a gentle signal — your connections are expanding naturally.
        </p>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="default"
            className="text-xs"
            onClick={() => navigate(tenantPath('/metros'))}
          >
            Explore Expansion Planning
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={() => dismiss.mutate(moment.id)}
            disabled={dismiss.isPending}
          >
            Dismiss
          </Button>
        </div>
      </div>
      <button
        onClick={() => dismiss.mutate(moment.id)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
