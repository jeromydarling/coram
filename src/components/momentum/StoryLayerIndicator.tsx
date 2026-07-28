import type { MetroStoryData, StoryDensityLabel } from '@/hooks/useStoryMomentum';
import { Feather, Users, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActiveLayer = 'pulse' | 'partners' | 'ink';

interface StoryLayerIndicatorProps {
  storyData: MetroStoryData;
  activeLayer: ActiveLayer;
  x: number;
  y: number;
}

const densityRippleOpacity: Record<StoryDensityLabel, number> = {
  quiet: 0,
  active: 0.15,
  growing: 0.25,
  vibrant: 0.4,
};

/**
 * Renders a subtle visual overlay on a metro marker based on the active story layer.
 * This is a foreignObject inside SVG, rendered above the heat marker.
 */
export function StoryLayerIndicator({ storyData, activeLayer, x, y }: StoryLayerIndicatorProps) {
  const rippleOpacity = densityRippleOpacity[storyData.densityLabel];

  if (activeLayer === 'pulse') {
    if (storyData.sources.local_pulse_event_count === 0 && storyData.sources.metro_signal_count === 0) return null;
    return (
      <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
        {/* Soft ripple ring */}
        <circle
          r={18}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          opacity={rippleOpacity}
          className="animate-pulse"
        />
        <foreignObject x={10} y={-18} width={16} height={16} style={{ overflow: 'visible' }}>
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20">
            <Waves className="w-2.5 h-2.5 text-primary" />
          </div>
        </foreignObject>
      </g>
    );
  }

  if (activeLayer === 'partners') {
    if (storyData.sources.partner_activity_count === 0) return null;
    const count = Math.min(storyData.sources.partner_activity_count, 3);
    return (
      <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
        <foreignObject x={10} y={-18} width={20} height={16} style={{ overflow: 'visible' }}>
          <div className="flex items-center gap-0.5">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-accent/40">
              <Users className="w-2.5 h-2.5 text-accent-foreground" />
            </div>
            {count > 1 && (
              <span className="text-[9px] font-medium text-accent-foreground/80">{count}</span>
            )}
          </div>
        </foreignObject>
      </g>
    );
  }

  if (activeLayer === 'ink') {
    if (storyData.sources.reflections_count === 0) return null;
    return (
      <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
        <foreignObject x={10} y={-18} width={16} height={16} style={{ overflow: 'visible' }}>
          <div className={cn(
            "flex items-center justify-center w-4 h-4 rounded-full",
            storyData.sources.reflections_count >= 3 ? "bg-primary/30" : "bg-muted/60"
          )}>
            <Feather className={cn(
              "w-2.5 h-2.5",
              storyData.sources.reflections_count >= 3 ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
        </foreignObject>
      </g>
    );
  }

  return null;
}
