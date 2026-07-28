import { useTranslation } from 'react-i18next';
import { Anchor } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface TopAnchorsTableProps {
  anchors: Anchor[];
}

export function TopAnchorsTable({ anchors }: TopAnchorsTableProps) {
  const { t } = useTranslation('dashboard');
  const sortedAnchors = [...anchors]
    .sort((a, b) => b.avgMonthlyVolume - a.avgMonthlyVolume)
    .slice(0, 5);

  const getTrendIcon = (trend: Anchor['growthTrend']) => {
    switch (trend) {
      case 'Up':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'Down':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: Anchor['productionStatus']) => {
    const styles = {
      'Scale': 'bg-success/15 text-success',
      'Stable': 'bg-primary/15 text-primary',
      'Ramp': 'bg-warning/15 text-warning',
      'Pre-Production': 'bg-muted text-muted-foreground'
    };
    return styles[status] || styles['Pre-Production'];
  };

  const getTierBadge = (tier: Anchor['anchorTier']) => {
    const styles = {
      'Strategic': 'bg-accent/15 text-accent border border-accent/30',
      'Standard': 'bg-primary/15 text-primary',
      'Pilot': 'bg-muted text-muted-foreground'
    };
    return styles[tier] || styles['Standard'];
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">{t('topAnchorsTable.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('topAnchorsTable.subtitle')}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('topAnchorsTable.col.organization')}</th>
              <th>{t('topAnchorsTable.col.metro')}</th>
              <th>{t('topAnchorsTable.col.tier')}</th>
              <th>{t('topAnchorsTable.col.avgVolume')}</th>
              <th>{t('topAnchorsTable.col.trend')}</th>
              <th>{t('topAnchorsTable.col.status')}</th>
              <th>{t('topAnchorsTable.col.value')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedAnchors.map((anchor, index) => (
              <tr key={anchor.anchorId} className={cn('animate-fade-in', `stagger-${index + 1}`)}>
                <td className="font-medium text-foreground">{anchor.organization}</td>
                <td className="text-muted-foreground">{anchor.metro}</td>
                <td>
                  <span className={cn('status-badge', getTierBadge(anchor.anchorTier))}>
                    {anchor.anchorTier}
                  </span>
                </td>
                <td className="font-semibold">{anchor.avgMonthlyVolume.toLocaleString()}</td>
                <td>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(anchor.growthTrend)}
                    <span className={cn(
                      'text-sm',
                      anchor.growthTrend === 'Up' && 'text-success',
                      anchor.growthTrend === 'Down' && 'text-destructive',
                      anchor.growthTrend === 'Flat' && 'text-muted-foreground'
                    )}>
                      {anchor.growthTrend}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={cn('status-badge', getStatusBadge(anchor.productionStatus))}>
                    {anchor.productionStatus}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'w-3.5 h-3.5',
                          i < anchor.strategicValue1to5
                            ? 'fill-warning text-warning'
                            : 'text-muted'
                        )}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
