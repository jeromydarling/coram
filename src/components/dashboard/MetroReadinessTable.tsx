import { useTranslation } from 'react-i18next';
import { Metro } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetroReadinessTableProps {
  metros: Metro[];
}

export function MetroReadinessTable({ metros }: MetroReadinessTableProps) {
  const { t } = useTranslation('dashboard');
  const sortedMetros = [...metros].sort((a, b) => b.metroReadinessIndex - a.metroReadinessIndex);

  const getStatusBadge = (status: Metro['metroStatus']) => {
    const styles = {
      'Expansion Ready': 'status-expansion-ready',
      'Anchor Build': 'status-anchor-build',
      'Ecosystem Dev': 'status-ecosystem-dev'
    };
    return styles[status] || 'status-ecosystem-dev';
  };

  const getRecommendationBadge = (rec: Metro['recommendation']) => {
    const styles = {
      'Invest': 'recommendation-invest',
      'Build Anchors': 'recommendation-build',
      'Hold': 'recommendation-hold',
      'Triage': 'recommendation-triage'
    };
    return styles[rec] || 'recommendation-hold';
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'hsl(var(--success))';
    if (score >= 50) return 'hsl(var(--warning))';
    return 'hsl(var(--info))';
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">{t('metroReadinessTable.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('metroReadinessTable.subtitle')}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('metroReadinessTable.col.metro')}</th>
              <th>{t('metroReadinessTable.col.readinessIndex')}</th>
              <th>{t('metroReadinessTable.col.status')}</th>
              <th>{t('metroReadinessTable.col.activeAnchors')}</th>
              <th>{t('metroReadinessTable.col.pipeline')}</th>
              <th>{t('metroReadinessTable.col.recommendation')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedMetros.map((metro, index) => (
              <tr key={metro.metroId} className={cn('animate-fade-in', `stagger-${index + 1}`)}>
                <td className="font-medium text-foreground">{metro.metro}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="score-bar w-24">
                      <div
                        className="score-fill"
                        style={{
                          width: `${metro.metroReadinessIndex}%`,
                          background: getScoreColor(metro.metroReadinessIndex)
                        }}
                      />
                    </div>
                    <span className="font-semibold text-sm" style={{ color: getScoreColor(metro.metroReadinessIndex) }}>
                      {metro.metroReadinessIndex}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={cn('status-badge', getStatusBadge(metro.metroStatus))}>
                    {metro.metroStatus}
                  </span>
                </td>
                <td>
                  <span className="font-semibold">{metro.activeAnchors}</span>
                </td>
                <td>
                  <span className="text-muted-foreground">{metro.anchorsInPipeline}</span>
                </td>
                <td>
                  <span className={cn('status-badge px-3 py-1 rounded-md', getRecommendationBadge(metro.recommendation))}>
                    {metro.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
