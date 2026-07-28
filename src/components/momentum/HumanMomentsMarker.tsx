import { Camera } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HumanMomentsMarkerProps {
  metroId: string;
  metroName: string;
  hasHumanMoments: boolean;
  x: number;
  y: number;
}

export function HumanMomentsMarker({ 
  metroId, 
  metroName, 
  hasHumanMoments, 
  x, 
  y 
}: HumanMomentsMarkerProps) {
  if (!hasHumanMoments) return null;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <g
          transform={`translate(${x + 12}, ${y - 12})`}
          className="cursor-pointer"
          style={{ pointerEvents: 'all' }}
        >
          <circle
            r={8}
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
          />
          <foreignObject
            x={-6}
            y={-6}
            width={12}
            height={12}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div className="flex items-center justify-center w-full h-full">
              <Camera className="w-3 h-3 text-primary" />
            </div>
          </foreignObject>
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p>{metroName} has event stories</p>
      </TooltipContent>
    </Tooltip>
  );
}
