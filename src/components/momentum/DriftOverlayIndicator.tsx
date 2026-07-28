import type { DriftLabel } from '@/hooks/useMetroDrift';
import { cn } from '@/lib/utils';

interface DriftOverlayIndicatorProps {
  driftScore: number;
  driftLabel: DriftLabel;
  emergingTopics: string[];
  x: number;
  y: number;
}

const driftColors: Record<DriftLabel, string> = {
  steady: 'hsl(var(--muted-foreground))',
  shifting: 'hsl(var(--accent))',
  changing: 'hsl(var(--primary))',
};

const driftOpacity: Record<DriftLabel, number> = {
  steady: 0.1,
  shifting: 0.2,
  changing: 0.35,
};

/**
 * Renders a subtle drift indicator on metro markers in the heat map.
 * Soft tint only — no alarming colors or warning icons.
 */
export function DriftOverlayIndicator({ driftScore, driftLabel, emergingTopics, x, y }: DriftOverlayIndicatorProps) {
  if (driftScore === 0) return null;

  const opacity = driftOpacity[driftLabel];
  const color = driftColors[driftLabel];

  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      {/* Soft glow ring — intensity based on drift label */}
      <circle
        r={16}
        fill={color}
        opacity={opacity * 0.5}
      />
      <circle
        r={12}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={opacity}
        strokeDasharray={driftLabel === 'changing' ? '3 2' : undefined}
      />
      {/* Tooltip content via foreignObject */}
      <foreignObject x={10} y={-20} width={80} height={24} style={{ overflow: 'visible' }}>
        <div className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium whitespace-nowrap",
          driftLabel === 'steady' && "bg-muted/60 text-muted-foreground",
          driftLabel === 'shifting' && "bg-accent/30 text-accent-foreground",
          driftLabel === 'changing' && "bg-primary/20 text-primary",
        )}>
          <span className="capitalize">{driftLabel}</span>
          {emergingTopics.length > 0 && (
            <span className="text-[7px] opacity-70 truncate max-w-[50px]">
              {emergingTopics[0]}
            </span>
          )}
        </div>
      </foreignObject>
    </g>
  );
}
