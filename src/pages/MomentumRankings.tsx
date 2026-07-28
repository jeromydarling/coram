import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Activity, TrendingUp, TrendingDown, Minus, Search, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAllMomentumRankings } from '@/hooks/useRelationshipMomentum';
import { formatDistanceToNow } from 'date-fns';

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising') return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
  if (trend === 'falling') return <TrendingDown className="w-4 h-4 text-destructive" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function trendColor(trend: string) {
  if (trend === 'rising') return 'bg-green-500/15 text-green-700 dark:text-green-400';
  if (trend === 'falling') return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-muted-foreground';
}

function scoreBarColor(score: number) {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-warning';
  if (score >= 25) return 'bg-orange-500';
  return 'bg-muted-foreground';
}

export default function MomentumRankings() {
  const { t } = useTranslation('intelligence');
  const navigate = useNavigate();
  const { data: rankings, isLoading } = useAllMomentumRankings();
  const [search, setSearch] = useState('');
  const [trendFilter, setTrendFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (!rankings) return [];
    return rankings.filter((r) => {
      if (trendFilter !== 'all' && r.trend !== trendFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.organization_name?.toLowerCase().includes(q) ||
          r.metro_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rankings, search, trendFilter]);

  return (
    <MainLayout title={t('momentumRankings.title')} subtitle={t('momentumRankings.subtitle')}>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('momentumRankings.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={trendFilter} onValueChange={setTrendFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('momentumRankings.filterByTrend')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('momentumRankings.trends.all')}</SelectItem>
              <SelectItem value="rising">{t('momentumRankings.trends.rising')}</SelectItem>
              <SelectItem value="stable">{t('momentumRankings.trends.stable')}</SelectItem>
              <SelectItem value="falling">{t('momentumRankings.trends.falling')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        {!isLoading && rankings && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{rankings.length}</p>
                <p className="text-xs text-muted-foreground">{t('momentumRankings.summary.scoredOrgs')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {rankings.filter((r) => r.trend === 'rising').length}
                </p>
                <p className="text-xs text-muted-foreground">{t('momentumRankings.summary.rising')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">
                  {rankings.filter((r) => r.trend === 'stable').length}
                </p>
                <p className="text-xs text-muted-foreground">{t('momentumRankings.summary.stable')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-destructive">
                  {rankings.filter((r) => r.trend === 'falling').length}
                </p>
                <p className="text-xs text-muted-foreground">{t('momentumRankings.summary.falling')}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rankings List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {t('momentumRankings.rankingsCard')}
              <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {rankings?.length === 0
                  ? t('momentumRankings.emptyNoData')
                  : t('momentumRankings.emptyNoMatch')}
              </p>
            ) : (
              <div className="space-y-1">
                {filtered.map((r, idx) => (
                  <div
                    key={r.opportunity_id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/opportunities/${r.opportunity_id}`)}
                  >
                    {/* Rank */}
                    <span className="text-sm font-mono text-muted-foreground w-8 text-right shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Score bar */}
                    <div className="w-16 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold w-7 text-right">{r.score}</span>
                        <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', scoreBarColor(r.score))}
                            style={{ width: `${r.score}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Trend */}
                    <div className="w-20 shrink-0 flex items-center gap-1">
                      <TrendIcon trend={r.trend} />
                      <Badge className={cn('text-[10px]', trendColor(r.trend))}>
                        {r.score_delta > 0 ? '+' : ''}{r.score_delta}
                      </Badge>
                    </div>

                    {/* Org info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.organization_name || 'Unknown'}</p>
                      {r.metro_name && (
                        <p className="text-xs text-muted-foreground truncate">{r.metro_name}</p>
                      )}
                    </div>

                    {/* Top driver */}
                    {r.drivers[0] && (
                      <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground max-w-48 truncate">
                        <span className="truncate">{r.drivers[0].label}</span>
                        {r.drivers[0].evidence_url && (
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        )}
                      </div>
                    )}

                    {/* Computed at */}
                    <span className="text-xs text-muted-foreground hidden lg:block shrink-0">
                      {formatDistanceToNow(new Date(r.computed_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
