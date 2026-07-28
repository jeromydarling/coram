import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Radar as RadarIcon,
  AlertTriangle,
  AlertCircle,
  Clock,
  Zap,
  ChevronRight,
  Building2,
  MapPin,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRadarData, type RadarOpportunity, type RadarSignal } from '@/hooks/useRadarData';
import { formatDistanceToNow } from 'date-fns';

function UrgencyBadge({ label }: { label: RadarOpportunity['urgencyLabel'] }) {
  const styles = {
    critical: 'bg-destructive/15 text-destructive border-destructive/30',
    high: 'bg-warning/15 text-warning border-warning/30',
    medium: 'bg-primary/15 text-primary border-primary/30',
    low: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={cn('text-xs capitalize', styles[label])}>
      {label}
    </Badge>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4 px-4">
        <div className={cn('p-2 rounded-lg', color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OpportunityRow({ opp, onClick }: { opp: RadarOpportunity; onClick: () => void }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50',
        opp.urgencyLabel === 'critical' && 'border-l-4 border-l-destructive bg-destructive/5',
        opp.urgencyLabel === 'high' && 'border-l-4 border-l-warning bg-warning/5',
        opp.urgencyLabel === 'medium' && 'border-l-4 border-l-primary bg-primary/5',
        opp.urgencyLabel === 'low' && 'border-l-4 border-l-muted',
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{opp.organization}</span>
          <UrgencyBadge label={opp.urgencyLabel} />
          <Badge variant="outline" className="text-xs">{opp.stage}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {opp.reasons.slice(0, 2).map((r, i) => (
            <span key={i} className="text-xs text-muted-foreground">{r}</span>
          ))}
        </div>
        {opp.metroName && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" />
            {opp.metroName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {opp.signalCount > 0 && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Zap className="w-3 h-3" />
            {opp.signalCount}
          </Badge>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function SignalRow({ signal }: { signal: RadarSignal }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{signal.signal_type}</span>
          {signal.organization && (
            <span className="text-xs text-muted-foreground truncate">• {signal.organization}</span>
          )}
        </div>
        {signal.signal_value && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{signal.signal_value}</p>
        )}
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(signal.detected_at), { addSuffix: true })}
        </span>
      </div>
      {signal.confidence !== null && (
        <Badge variant="outline" className="text-xs shrink-0">
          {Math.round(signal.confidence * 100)}%
        </Badge>
      )}
    </div>
  );
}

export default function Radar() {
  const { t } = useTranslation('intelligence');
  const navigate = useNavigate();
  const { data, isLoading } = useRadarData();
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'signals'>('all');

  const filteredOpps = data?.opportunities.filter(opp => {
    if (filter === 'critical') return opp.urgencyLabel === 'critical';
    if (filter === 'high') return opp.urgencyLabel === 'critical' || opp.urgencyLabel === 'high';
    if (filter === 'signals') return opp.signalCount > 0;
    return true;
  }) ?? [];

  return (
    <MainLayout
      title={t('radar.title')}
      mobileTitle={t('radar.mobileTitle')}
      data-testid="radar-root"
      subtitle={t('radar.subtitle')}
    >
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))
          ) : (
            <>
              <StatCard label={t('radar.stats.critical')} value={data?.stats.critical ?? 0} icon={AlertTriangle} color="bg-destructive/15 text-destructive" />
              <StatCard label={t('radar.stats.highPriority')} value={data?.stats.high ?? 0} icon={AlertCircle} color="bg-warning/15 text-warning" />
              <StatCard label={t('radar.stats.medium')} value={data?.stats.medium ?? 0} icon={Clock} color="bg-primary/15 text-primary" />
              <StatCard label={t('radar.stats.withSignals')} value={data?.stats.withSignals ?? 0} icon={Zap} color="bg-accent/15 text-accent" />
            </>
          )}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="attention" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attention" className="gap-1">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">{t('radar.tabs.attentionQueue')}</span>
              <span className="sm:hidden">{t('radar.tabs.attentionShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="signals" className="gap-1">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">{t('radar.tabs.signalFeed')}</span>
              <span className="sm:hidden">{t('radar.tabs.signalsShort')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attention" className="space-y-4">
            {/* Filter buttons */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all' as const, label: t('radar.filters.all') },
                { key: 'critical' as const, label: t('radar.filters.criticalOnly') },
                { key: 'high' as const, label: t('radar.filters.highPlus') },
                { key: 'signals' as const, label: t('radar.filters.hasSignals') },
              ].map(f => (
                <Button
                  key={f.key}
                  variant={filter === f.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredOpps.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">{t('radar.empty.noPendingActions')}</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="space-y-2 pr-4">
                  {filteredOpps.map(opp => (
                    <OpportunityRow
                      key={opp.id}
                      opp={opp}
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="signals" className="space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (data?.signalFeed.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">{t('radar.empty.noSignals')}</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-16rem)]">
                <div className="space-y-2 pr-4">
                  {data?.signalFeed.map(signal => (
                    <SignalRow key={signal.id} signal={signal} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
