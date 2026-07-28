import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface AnchorTrendData {
  month: string;
  count: number;
}

interface AnchorTrendChartProps {
  data: AnchorTrendData[];
}

export function AnchorTrendChart({ data }: AnchorTrendChartProps) {
  const { t } = useTranslation('dashboard');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} {payload[0].value === 1 ? t('anchorTrendChart.anchorFormed') : t('anchorTrendChart.anchorsFormed')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-foreground">{t('anchorTrendChart.title')}</h3>
          <HelpTooltip contentKey="card.anchor-trend" />
        </div>
        <p className="text-sm text-muted-foreground">{t('anchorTrendChart.subtitle')}</p>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="anchorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#anchorGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
