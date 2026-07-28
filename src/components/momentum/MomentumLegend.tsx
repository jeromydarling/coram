import { cn } from '@/lib/utils';

const legendItems = [
  { status: 'Resting', color: 'bg-[#4ECDC4]', description: 'Building foundation' },
  { status: 'Steady', color: 'bg-[#F5C6A5]', description: 'Consistent activity' },
  { status: 'Growing', color: 'bg-[#FFD93D]', description: 'Momentum increasing' },
  { status: 'Strong', color: 'bg-[#FFB627]', description: 'High momentum', glow: true },
];

interface MomentumLegendProps {
  className?: string;
}

export function MomentumLegend({ className }: MomentumLegendProps) {
  return (
    <div className={cn('bg-card/80 backdrop-blur-sm rounded-lg p-3 shadow-lg', className)}>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">Momentum</h4>
      <div className="space-y-1.5">
        {legendItems.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <div
              className={cn(
                'w-3 h-3 rounded-full',
                item.color,
                item.glow && 'animate-pulse shadow-lg shadow-[#FFB627]/50'
              )}
            />
            <span className="text-xs font-medium">{item.status}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              · {item.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
