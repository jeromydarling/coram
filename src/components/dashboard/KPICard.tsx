import { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  accentColor?: string;
  className?: string;
}

export function KPICard({
  label,
  value,
  change,
  changeLabel,
  trend = 'neutral',
  icon,
  accentColor = 'hsl(var(--primary))',
  className
}: KPICardProps) {
  return (
    <div className={cn('kpi-card animate-fade-in', className)}>
      <div 
        className="kpi-card-accent" 
        style={{ background: accentColor }}
      />
      
      <div className="flex items-start justify-between">
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
