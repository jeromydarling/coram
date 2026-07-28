import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { MetroMomentum } from '@/hooks/useMomentumData';
import { MetroTooltip } from './MetroTooltip';
import { MilestoneBloom } from './MilestoneBloom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MetroHeatMarkerProps {
  metro: MetroMomentum;
  x: number;
  y: number;
  onClick: (metro: MetroMomentum) => void;
}

const statusColors: Record<MetroMomentum['momentumStatus'], { fill: string; glow: string }> = {
  Resting: { fill: '#4ECDC4', glow: 'rgba(78, 205, 196, 0.4)' },
  Steady: { fill: '#F5C6A5', glow: 'rgba(245, 198, 165, 0.4)' },
  Growing: { fill: '#FFD93D', glow: 'rgba(255, 217, 61, 0.5)' },
  Strong: { fill: '#FFB627', glow: 'rgba(255, 182, 39, 0.6)' },
};

export function MetroHeatMarker({ metro, x, y, onClick }: MetroHeatMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = statusColors[metro.momentumStatus];
  
  // Size based on momentum status
  const baseSize = metro.momentumStatus === 'Strong' ? 10 : 
                   metro.momentumStatus === 'Growing' ? 8 : 
                   metro.momentumStatus === 'Steady' ? 7 : 6;
  
  const isStrong = metro.momentumStatus === 'Strong';

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <g
          transform={`translate(${x}, ${y})`}
          onClick={() => onClick(metro)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="cursor-pointer"
          style={{ pointerEvents: 'all' }}
        >
          {/* Outer glow */}
          <circle
            r={baseSize * 2}
            fill={colors.glow}
            className={cn(
              'transition-all duration-300',
              isStrong && 'animate-pulse'
            )}
            style={{
              opacity: isHovered ? 0.8 : 0.4,
            }}
          />
          
          {/* Middle glow */}
          <circle
            r={baseSize * 1.4}
            fill={colors.glow}
            className="transition-all duration-300"
            style={{
              opacity: isHovered ? 0.9 : 0.6,
            }}
          />
          
          {/* Core circle */}
          <circle
            r={baseSize}
            fill={colors.fill}
            stroke="white"
            strokeWidth={1.5}
            className={cn(
              'transition-all duration-300',
              isHovered && 'scale-125'
            )}
            style={{
              filter: isStrong ? 'drop-shadow(0 0 4px rgba(255, 182, 39, 0.8))' : undefined,
              transformOrigin: 'center',
            }}
          />
          
          {/* Milestone marker - positioned relatively */}
          {metro.hasMilestone && (
            <foreignObject
              x={baseSize - 2}
              y={-baseSize - 6}
              width={16}
              height={16}
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <MilestoneBloom
                metroId={metro.metroId}
                achieved={metro.hasMilestone}
              />
            </foreignObject>
          )}
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="p-0 border-0 bg-transparent shadow-none">
        <MetroTooltip metro={metro} />
      </TooltipContent>
    </Tooltip>
  );
}
