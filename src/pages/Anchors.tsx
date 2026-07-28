import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAnchors, AnchorWithComputed } from '@/hooks/useAnchors';
import { AnchorDetailModal } from '@/components/modals/AnchorDetailModal';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Anchor as AnchorIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Calendar,
  ChevronRight,
  Filter,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePersistentFilter } from '@/hooks/usePersistentFilter';

type GrowthTrend = 'Up' | 'Flat' | 'Down';
type RiskLevel = 'Low' | 'Medium' | 'High';
type AnchorTier = 'Strategic' | 'Standard' | 'Pilot';
type ProductionStatus = 'Pre-Production' | 'Ramp' | 'Stable' | 'Scale';

export default function Anchors() {
  const { t } = useTranslation('relationships');
  const [searchQuery, setSearchQuery] = usePersistentFilter('anchors-search', '');
  const [statusFilter, setStatusFilter] = usePersistentFilter('anchors-status-filter', 'all');
  const [selectedAnchor, setSelectedAnchor] = useState<AnchorWithComputed | null>(null);
  
  const { data: anchors, isLoading } = useAnchors();

  const filteredAnchors = useMemo(() => {
    if (!anchors) return [];
    
    return anchors.filter(anchor => {
      const matchesSearch = anchor.organization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anchor.metro?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || anchor.productionStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [anchors, searchQuery, statusFilter]);

  const getTrendIcon = (trend: GrowthTrend | null | undefined) => {
    switch (trend) {
      case 'Up':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'Down':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ProductionStatus | undefined) => {
    const styles: Record<ProductionStatus, string> = {
      'Scale': 'bg-success/15 text-success',
      'Stable': 'bg-primary/15 text-primary',
      'Ramp': 'bg-warning/15 text-warning',
      'Pre-Production': 'bg-muted text-muted-foreground'
    };
    return styles[status || 'Pre-Production'] || styles['Pre-Production'];
  };

  const getTierBadge = (tier: AnchorTier | null | undefined) => {
    const styles: Record<AnchorTier, string> = {
      'Strategic': 'bg-accent/15 text-accent border border-accent/30',
      'Standard': 'bg-primary/15 text-primary',
      'Pilot': 'bg-muted text-muted-foreground'
    };
    return styles[tier || 'Standard'] || styles['Standard'];
  };

  const getRiskBadge = (risk: RiskLevel | null | undefined) => {
    const styles: Record<RiskLevel, string> = {
      'Low': 'text-success',
      'Medium': 'text-warning',
      'High': 'text-destructive'
    };
    return styles[risk || 'Medium'] || 'text-muted-foreground';
  };

  // Calculate summary stats
  const totalVolume = useMemo(() => 
    filteredAnchors.reduce((sum, a) => sum + (a.last_30_day_volume || 0), 0),
    [filteredAnchors]
  );

  const avgVolume = useMemo(() => {
    if (filteredAnchors.length === 0) return 0;
    return Math.round(filteredAnchors.reduce((sum, a) => sum + (a.avg_monthly_volume || 0), 0) / filteredAnchors.length);
  }, [filteredAnchors]);

  const strategicCount = useMemo(() => 
    filteredAnchors.filter(a => a.anchor_tier === 'Strategic').length,
    [filteredAnchors]
  );

  const growingCount = useMemo(() => 
    filteredAnchors.filter(a => a.growth_trend === 'Up').length,
    [filteredAnchors]
  );

  return (
    <MainLayout
      title={t('anchors.title')}
      subtitle={t('anchors.subtitle')}
      data-testid="anchors-root"
      helpKey="page.anchors"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('anchors.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('anchors.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('anchors.statuses.all')}</SelectItem>
                <SelectItem value="Scale">{t('anchors.statuses.scale')}</SelectItem>
                <SelectItem value="Stable">{t('anchors.statuses.stable')}</SelectItem>
                <SelectItem value="Ramp">{t('anchors.statuses.ramp')}</SelectItem>
                <SelectItem value="Pre-Production">{t('anchors.statuses.preProduction')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">{t('anchors.stats.totalVolume30d')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalVolume.toLocaleString()}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">{t('anchors.stats.avgMonthlyVolume')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {avgVolume.toLocaleString()}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">{t('anchors.stats.strategicPartners')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {strategicCount}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">{t('anchors.stats.growing')}</p>
                <p className="text-2xl font-bold text-success">
                  {growingCount}
                </p>
              </div>
            </div>

            {filteredAnchors.length === 0 ? (
              <div className="text-center py-12">
                <AnchorIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {searchQuery || statusFilter !== 'all'
                    ? t('anchors.empty.noMatch')
                    : t('anchors.empty.noAnchors')}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all'
                    ? t('anchors.empty.noMatchHint')
                    : t('anchors.empty.noAnchorsHint')}
                </p>
              </div>
            ) : (
              /* Anchors Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-tour="anchors-list">
                {filteredAnchors.map((anchor, index) => (
                  <div 
                    key={anchor.anchor_id}
                    className={cn(
                      'bg-card rounded-xl border border-border p-5 hover:shadow-card-hover transition-all duration-200 cursor-pointer animate-fade-in group',
                      `stagger-${(index % 6) + 1}`
                    )}
                    data-tour={index === 0 ? "anchors-card" : undefined}
                    onClick={() => setSelectedAnchor(anchor)}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg">
                          <AnchorIcon className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {anchor.organization}
                          </h3>
                          <p className="text-sm text-muted-foreground">{anchor.metro}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={cn('status-badge', getTierBadge(anchor.anchor_tier))}>
                        {anchor.anchor_tier || 'Standard'}
                      </span>
                      <span className={cn('status-badge', getStatusBadge(anchor.productionStatus))}>
                        {anchor.productionStatus || 'Pre-Production'}
                      </span>
                    </div>

                    {/* Volume Stats */}
                    <div className="bg-muted/50 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">{t('anchors.card.monthlyVolume')}</span>
                        <div className="flex items-center gap-1">
                          {getTrendIcon(anchor.growth_trend)}
                          <span className={cn(
                            'text-sm font-medium',
                            anchor.growth_trend === 'Up' && 'text-success',
                            anchor.growth_trend === 'Down' && 'text-destructive'
                          )}>
                            {anchor.growth_trend || 'Flat'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-foreground">{anchor.last_30_day_volume || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('anchors.card.last30d')}</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">{anchor.avg_monthly_volume || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('anchors.card.avg')}</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">{anchor.peak_monthly_volume || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('anchors.card.peak')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="flex items-center justify-between text-sm mb-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{t('anchors.card.monthsActive', { count: anchor.monthsActive || 0 })}</span>
                      </div>
                      <div className={cn('font-medium', getRiskBadge(anchor.risk_level))}>
                        {t('anchors.card.risk', { level: anchor.risk_level || 'Medium' })}
                      </div>
                    </div>

                    {/* Strategic Value */}
                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('anchors.card.strategicValue')}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i}
                            className={cn(
                              'w-4 h-4',
                              i < (anchor.strategic_value_1to5 || 3)
                                ? 'fill-warning text-warning' 
                                : 'text-muted'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Anchor Detail Modal */}
      <AnchorDetailModal 
        open={!!selectedAnchor} 
        onOpenChange={(open) => !open && setSelectedAnchor(null)} 
        anchor={selectedAnchor}
      />
    </MainLayout>
  );
}
