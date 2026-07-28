/**
 * OperatorEcosystemRhythms — Cross-tenant awareness patterns for operators.
 *
 * WHAT: Displays anonymized communio awareness signal trends.
 * WHERE: /operator/nexus/lumen — Ecosystem Rhythms section.
 * WHY: Operators see network-wide patterns, never individual tenant actions.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, Feather, CalendarPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const RHYTHM_ICONS: Record<string, React.ElementType> = {
  visit_without_followup: Feather,
  activity_dropoff: CalendarPlus,
  partner_silence_gap: Users,
  event_followup_missing: Feather,
};

const RHYTHM_LABELS: Record<string, string> = {
  visit_without_followup: 'Reflections after visits',
  activity_dropoff: 'Activity rhythm patterns',
  partner_silence_gap: 'Partner reconnection',
  event_followup_missing: 'Event follow-through',
};

export function OperatorEcosystemRhythms() {
  const { data: signals, isLoading } = useQuery({
    queryKey: ['operator-ecosystem-rhythms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_awareness_signals')
        .select('id, source_signal_type, anonymized_message, visibility, created_at')
        .in('visibility', ['operator', 'both'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Group by signal type for trend counts
  const typeCounts = (signals || []).reduce((acc: Record<string, number>, s: any) => {
    acc[s.source_signal_type] = (acc[s.source_signal_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    );
  }

  if (!signals || signals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-serif">Ecosystem Rhythms</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> Anonymized patterns across all tenants.</p>
                <p><strong>Where:</strong> Aggregated from Vigilia companion signals.</p>
                <p><strong>Why:</strong> Ecosystem-level awareness without exposing anyone.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(typeCounts).map(([type, count]) => {
          const Icon = RHYTHM_ICONS[type] || Users;
          const label = RHYTHM_LABELS[type] || type.replace(/_/g, ' ');

          // Find the latest message for this type
          const latest = signals.find((s: any) => s.source_signal_type === type);

          return (
            <div key={type} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <div className="p-2 rounded-lg bg-muted shrink-0">
                <Icon className="w-4 h-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">· {count as number} signal{(count as number) !== 1 ? 's' : ''}</span>
                </div>
                {latest && (
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    {latest.anonymized_message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
