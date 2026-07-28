import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface DistributionData {
  name: string;
  count: number;
  color: string;
}

interface OpportunityDistributionChartProps {
  title: string;
  subtitle: string;
  data: DistributionData[];
  filterType?: 'tier' | 'grant';
}

export function OpportunityDistributionChart({ title, subtitle, data, filterType }: OpportunityDistributionChartProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const handleClick = useCallback((entry: DistributionData) => {
    if (!filterType) return;

    const params = new URLSearchParams();
    if (filterType === 'tier') {
      params.set('tier', entry.name);
    } else if (filterType === 'grant') {
      params.set('grant', entry.name);
    }
    navigate(`/opportunities?${params.toString()}`);
  }, [filterType, navigate]);

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
        />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 pointer-events-none">
          <p className="font-medium text-sm text-foreground">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {item.count} {item.count === 1 ? t('opportunityDistributionChart.opportunity') : t('opportunityDistributionChart.opportunities')} ({percentage}%)
          </p>
          {filterType && (
            <p className="text-xs text-primary mt-1 font-medium">{t('opportunityDistributionChart.clickToFilter')}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {payload.map((entry: any, index: number) => (
          <button
            key={`legend-${index}`}
            onClick={() => handleClick(entry.payload)}
            className={`flex items-center gap-1.5 text-xs transition-all ${
              filterType ? 'hover:opacity-70 cursor-pointer' : ''
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
            <span className="font-medium text-foreground">({entry.payload.count})</span>
          </button>
        ))}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 animate-fade-in">
        <div className="mb-4">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          {t('opportunityDistributionChart.noDataAvailable')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={35}
              outerRadius={60}
              paddingAngle={2}
              dataKey="count"
              nameKey="name"
              activeIndex={activeIndex ?? undefined}
              activeShape={renderActiveShape}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              onClick={(_, index) => handleClick(data[index])}
              style={{ cursor: filterType ? 'pointer' : 'default' }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{ cursor: filterType ? 'pointer' : 'default' }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
