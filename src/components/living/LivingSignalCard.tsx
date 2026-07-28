/**
 * LivingSignalCard — Gentle narrative-aware prompt based on real activity.
 *
 * WHAT: Shows the most recent undismissed Living System signal as a calm card.
 * WHERE: Dashboard sidebar, Testimonium, Visits page.
 * WHY: Surfaces moments worth noticing without urgency or notification fatigue.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Feather, X } from 'lucide-react';

const SIGNAL_TITLES: Record<string, string> = {
  reflection_moment: 'A moment worth noticing',
  community_growth: 'Your community is growing',
  adoption_support_needed: 'A gentle nudge',
  collaboration_movement: 'Collaboration in motion',
  visitor_voice_pattern: 'Stories being captured',
};

export function LivingSignalCard() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: signal } = useQuery({
    queryKey: ['living-signal', tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('living_system_signals')
        .select('*')
        .eq('tenant_id', tenantId!)
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;

      // Filter out dismissed by current user client-side
      const undismissed = (data || []).find(
        (s: any) => !(s.dismissed_by_user_ids || []).includes(user!.id)
      );
      return undismissed || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const dismiss = useMutation({
    mutationFn: async (signalId: string) => {
      const currentIds = (signal as any)?.dismissed_by_user_ids || [];
      const { error } = await supabase
        .from('living_system_signals')
        .update({
          dismissed_by_user_ids: [...currentIds, user!.id],
        })
        .eq('id', signalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['living-signal'] });
    },
  });

  if (!signal) return null;

  const context = (signal as any).context_json || {};
  const title = SIGNAL_TITLES[(signal as any).signal_type] || 'A moment worth noticing';
  const narrative = context.narrative || 'Something is forming in your rhythm.';
  const showAdoptionLink = (signal as any).signal_type === 'adoption_support_needed';

  return (
    <Card className="bg-primary/5 border-primary/10">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
              <Feather className="w-4 h-4 text-primary" />
            </div>
            <h3
              className="text-sm font-semibold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {title}
            </h3>
          </div>
          <HelpTooltip
            content="Living System signals surface gently from your team's activity — no alerts, just awareness."
          />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>
        <div className="flex items-center gap-2 pt-1">
          {showAdoptionLink && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => window.location.href = '/help'}
            >
              Adoption Guide
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground ml-auto"
            onClick={() => dismiss.mutate(signal.id)}
            disabled={dismiss.isPending}
          >
            <X className="h-3 w-3 mr-1" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
