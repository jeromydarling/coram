import { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface SparklineData {
  value: number;
}

interface KPICardWithSparklineProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  accentColor?: string;
  className?: string;
  sparklineData?: SparklineData[];
}

export function KPICardWithSparkline({
  label,
  value,
  change,
  changeLabel,
  trend = 'neutral',
  icon,
  accentColor = 'hsl(var(--primary))',
  className,
  sparklineData
}: KPICardWithSparklineProps) {
  return (
    <div className={cn('kpi-card animate-fade-in relative overflow-hidden', className)}>
      <div 
        className="kpi-card-accent" 
        style={{ background: accentColor }}
      />
      
      {/* Sparkline Background */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColor}
                strokeWidth={1.5}
                fill={`url(#gradient-${label.replace(/\s/g, '')})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-2">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
          
          {change !== undefined && (
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium',
              trend === 'up' && 'text-success',
              trend === 'down' && 'text-destructive',
              trend === 'neutral' && 'text-muted-foreground'
            )}>
              {trend === 'up' && <ArrowUpRight className="w-4 h-4" />}
              {trend === 'down' && <ArrowDownRight className="w-4 h-4" />}
              {trend === 'neutral' && <Minus className="w-4 h-4" />}
              <span>{change > 0 ? '+' : ''}{change}%</span>
              {changeLabel && (
                <span className="text-muted-foreground font-normal">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        
        {icon && (
          <div 
            className="p-3 rounded-xl"
            style={{ background: `${accentColor}15` }}
          >
            <div style={{ color: accentColor }}>
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
