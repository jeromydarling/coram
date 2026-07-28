import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { HelpTooltip } from '@/components/ui/help-tooltip';

// ... keep existing code (interfaces)

interface PipelineStageData {
  stage: string;
  count: number;
  color: string;
}

interface PipelineChartProps {
  data: PipelineStageData[];
}

export function PipelineChart({ data }: PipelineChartProps) {
  const { t } = useTranslation('dashboard');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} {payload[0].value === 1 ? t('pipelineChart.opportunity') : t('pipelineChart.opportunities')}
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
          <h3 className="font-semibold text-foreground">{t('pipelineChart.title')}</h3>
          <HelpTooltip contentKey="card.pipeline-chart" />
        </div>
        <p className="text-sm text-muted-foreground">{t('pipelineChart.subtitle')}</p>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 100, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="stage"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
