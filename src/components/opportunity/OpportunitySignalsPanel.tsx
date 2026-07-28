import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, TrendingUp, Calendar, Users, MapPin, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface OpportunitySignalsPanelProps {
  opportunityId: string;
}

const sourceConfig: Record<string, { icon: typeof Zap; label: string; color: string }> = {
  grant: { icon: TrendingUp, label: 'Grant', color: 'bg-emerald-500/20 text-emerald-700 border-emerald-300' },
  event: { icon: Calendar, label: 'Event', color: 'bg-blue-500/20 text-blue-700 border-blue-300' },
  person: { icon: Users, label: 'Person', color: 'bg-purple-500/20 text-purple-700 border-purple-300' },
  neighborhood: { icon: MapPin, label: 'Area', color: 'bg-amber-500/20 text-amber-700 border-amber-300' },
  org_update: { icon: Building2, label: 'Org', color: 'bg-slate-500/20 text-slate-700 border-slate-300' },
};

export function OpportunitySignalsPanel({ opportunityId }: OpportunitySignalsPanelProps) {
  const { data: signals, isLoading } = useQuery({
    queryKey: ['opportunity-signals', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunity_signals')
        .select('id, signal_type, signal_value, confidence, created_at, source_url, detected_at')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!opportunityId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!signals || signals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Opportunity Signals
          <Badge variant="secondary" className="ml-auto">{signals.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {signals.map((signal) => {
          const config = sourceConfig[signal.signal_type] ?? sourceConfig.org_update;
          const Icon = config.icon;
          return (
            <div key={signal.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Badge className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                    {config.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {((signal.confidence ?? 0) * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <p className="text-xs">{signal.signal_value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(signal.detected_at ?? signal.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
