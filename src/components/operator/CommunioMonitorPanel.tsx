import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommunioMonitoring } from '@/hooks/useOperatorAdoption';
import { Heart, Sparkles, Globe } from 'lucide-react';

export function CommunioMonitorPanel() {
  const { data, isLoading } = useCommunioMonitoring();

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Communio Network</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Opt-in Tenants</p>
              <p className="text-xl font-bold text-foreground">{data?.optInCount ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shared Signals (7d)</p>
              <p className="text-xl font-bold text-foreground">{data?.sharedSignals7d ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Top Contributing Metros</p>
              <p className="text-xl font-bold text-foreground">{data?.topMetros?.length ?? 0}</p>
            </div>
          </div>
        </div>

        {data?.topMetros && data.topMetros.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Top metros by shared signal count:</p>
            {data.topMetros.map((m, i) => (
              <div key={m.metro_id} className="flex justify-between text-sm px-2 py-1 rounded bg-muted/30">
                <span className="text-muted-foreground">#{i + 1} {m.metro_id.slice(0, 8)}…</span>
                <span className="font-medium text-foreground">{m.count} signals</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
