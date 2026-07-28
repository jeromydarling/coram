import { useTranslation } from 'react-i18next';
import { useGrantKPIs, useGrantsByStage, useGrantsByFunderType } from '@/hooks/useGrantKPIs';
import { KPICardWithSparkline } from './KPICardWithSparkline';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, DollarSign, Award, TrendingUp, Star, Building2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface GrantKPICardsProps {
  metroId?: string | null;
}

export function GrantKPICards({ metroId }: GrantKPICardsProps) {
  const { t } = useTranslation('dashboard');
  const { data: kpis, isLoading: kpisLoading } = useGrantKPIs(metroId);

  if (kpisLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICardWithSparkline
        label={t('grantKPIs.activeGrants')}
        value={kpis?.activeGrants || 0}
        icon={<FileText className="w-6 h-6" />}
        accentColor="hsl(var(--primary))"
      />
      <KPICardWithSparkline
        label={t('grantKPIs.pipelineGrants')}
        value={kpis?.grantsInPipeline || 0}
        icon={<TrendingUp className="w-6 h-6" />}
        accentColor="hsl(var(--info))"
      />
      <KPICardWithSparkline
        label={t('grantKPIs.totalRequested')}
        value={formatCurrency(kpis?.totalAmountRequested || 0)}
        icon={<DollarSign className="w-6 h-6" />}
        accentColor="hsl(var(--warning))"
      />
      <KPICardWithSparkline
        label={t('grantKPIs.totalAwarded')}
        value={formatCurrency(kpis?.totalAmountAwarded || 0)}
        icon={<Award className="w-6 h-6" />}
        accentColor="hsl(var(--success))"
      />
    </div>
  );
}

export function GrantsByStageChart({ metroId }: GrantKPICardsProps) {
  const { t } = useTranslation('dashboard');
  const { data: stageData, isLoading } = useGrantsByStage(metroId);

  if (isLoading) {
    return <Skeleton className="h-80 rounded-xl" />;
  }

  const filteredData = (stageData || []).filter(s => s.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {t('grantKPIs.grantsByStage')}
        </CardTitle>
        <CardDescription>{t('grantKPIs.grantsByStageDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={filteredData} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="stage" width={120} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {filteredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function GrantsByFunderTypeChart({ metroId }: GrantKPICardsProps) {
  const { t } = useTranslation('dashboard');
  const { data: funderData, isLoading } = useGrantsByFunderType(metroId);

  if (isLoading) {
    return <Skeleton className="h-80 rounded-xl" />;
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {t('grantKPIs.grantsByFunderType')}
        </CardTitle>
        <CardDescription>{t('grantKPIs.grantsByFunderTypeDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={funderData || []}
              dataKey="amount"
              nameKey="funder_type"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ funder_type, amount }) => `${funder_type}: ${formatCurrency(amount)}`}
              labelLine={false}
            >
              {(funderData || []).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-4 justify-center">
          {(funderData || []).map((entry) => (
            <div key={entry.funder_type} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.funder_type}</span>
              <span className="font-medium">({entry.count})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
