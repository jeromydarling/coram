import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, DollarSign, Users, ArrowRight } from 'lucide-react';
import { MetroNewsPulseCard } from '@/components/metro/MetroNewsPulseCard';

const moduleIcons: Record<string, React.ReactNode> = {
  events: <Calendar className="h-4 w-4" />,
  grants: <DollarSign className="h-4 w-4" />,
  people: <Users className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  running: 'bg-chart-1/20 text-chart-1',
  completed: 'bg-primary/20 text-primary',
  failed: 'bg-destructive/20 text-destructive',
};

export default function DiscoveryRuns() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: runs, isLoading } = useQuery({
    queryKey: ['discovery-runs', moduleFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('discovery_runs')
        .select('id, module, scope, metro_id, opportunity_id, status, started_at, completed_at, stats, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (moduleFilter !== 'all') query = query.eq('module', moduleFilter);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">{t('discoveryRuns.title')}</h1>

      {/* Metro News Pulse — silent heartbeat */}
      <MetroNewsPulseCard />

      <div className="flex gap-3">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('discoveryRuns.modulePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('discoveryRuns.modules.all')}</SelectItem>
            <SelectItem value="events">{t('discoveryRuns.modules.events')}</SelectItem>
            <SelectItem value="grants">{t('discoveryRuns.modules.grants')}</SelectItem>
            <SelectItem value="people">{t('discoveryRuns.modules.people')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('discoveryRuns.statusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('discoveryRuns.statuses.all')}</SelectItem>
            <SelectItem value="running">{t('discoveryRuns.statuses.running')}</SelectItem>
            <SelectItem value="completed">{t('discoveryRuns.statuses.completed')}</SelectItem>
            <SelectItem value="failed">{t('discoveryRuns.statuses.failed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !runs || runs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('discoveryRuns.noRunsFound')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const stats = (run.stats || {}) as Record<string, number>;
            return (
              <Card
                key={run.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/discovery/runs/${run.id}`)}
              >
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  {moduleIcons[run.module] || null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">{run.module}</span>
                      <span className="text-xs text-muted-foreground">/ {run.scope}</span>
                      <Badge className={statusColors[run.status] || 'bg-muted'} variant="secondary">
                        {run.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(run.created_at).toLocaleString()}
                      {stats.items_upserted != null && ` · ${stats.items_upserted} items`}
                      {stats.new_items != null && stats.new_items > 0 && ` · ${stats.new_items} new`}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
