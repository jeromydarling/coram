/**
 * GardenerCompassOverlay — Contemplative directional overlay for the Garden Pulse.
 *
 * WHAT: Visual overlay showing four directional movements (Narrative, Discernment, Care, Restoration).
 * WHERE: GardenPulsePage — toggleable above all layers.
 * WHY: Discernment lens showing "how movement flows" — complements Providence's "where grace gathers".
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  type CompassWeight,
  COMPASS_LABELS,
  COMPASS_NARRATIVES,
  type CompassDirection,
} from '@/lib/compassDirection';

interface GardenerCompassOverlayProps {
  weights: CompassWeight;
  silentMode?: boolean;
  className?: string;
}

function intensity(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(1, value / total);
}

const DIRECTION_META: Record<CompassDirection, {
  posClass: string;
  barClass: string;
  color: string;
  textColor: string;
  glowColor: string;
}> = {
  north: {
    posClass: 'top-6 left-1/2 -translate-x-1/2 flex-col items-center',
    barClass: 'w-1 rounded-full',
    color: 'bg-amber-300',
    textColor: 'text-amber-200',
    glowColor: 'shadow-[0_0_12px_4px_rgba(252,211,77,0.35)]',
  },
  east: {
    posClass: 'top-1/2 right-6 -translate-y-1/2 flex-row-reverse items-center',
    barClass: 'h-1 rounded-full',
    color: 'bg-sky-300',
    textColor: 'text-sky-200',
    glowColor: 'shadow-[0_0_12px_4px_rgba(125,211,252,0.35)]',
  },
  south: {
    posClass: 'bottom-20 left-1/2 -translate-x-1/2 flex-col-reverse items-center',
    barClass: 'w-1 rounded-full',
    color: 'bg-emerald-300',
    textColor: 'text-emerald-200',
    glowColor: 'shadow-[0_0_12px_4px_rgba(110,231,183,0.3)]',
  },
  west: {
    posClass: 'top-1/2 left-6 -translate-y-1/2 flex-row items-center',
    barClass: 'h-1 rounded-full',
    color: 'bg-rose-300',
    textColor: 'text-rose-200',
    glowColor: 'shadow-[0_0_12px_4px_rgba(253,164,175,0.3)]',
  },
};

export function GardenerCompassOverlay({ weights, silentMode, className }: GardenerCompassOverlayProps) {
  const total = useMemo(() => weights.north + weights.east + weights.south + weights.west, [weights]);

  const directions = useMemo(() => {
    return (['north', 'east', 'south', 'west'] as CompassDirection[]).map(key => ({
      key,
      value: weights[key],
      pct: intensity(weights[key], total),
      meta: DIRECTION_META[key],
    }));
  }, [weights, total]);

  // Empty state
  if (total === 0) {
    return (
      <div className={cn('absolute inset-0 pointer-events-none z-40 flex items-center justify-center', className)}>
        <div className="bg-black/70 backdrop-blur-md rounded-lg px-5 py-4 text-center max-w-[240px] border border-white/10 shadow-lg">
          <p className="text-xs font-serif text-white/70 italic leading-relaxed">
            The compass is listening… awaiting movement to discern.
          </p>
        </div>
      </div>
    );
  }

  const dominant = directions.reduce((a, b) => (b.value > a.value ? b : a), directions[0]);

  return (
    <div className={cn('absolute inset-0 pointer-events-none z-40', className)}>
      {/* Compass rose center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-full border border-white/15 bg-black/40 backdrop-blur-sm flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20">
          <div className="text-center">
            <p className={cn('text-[9px] sm:text-xs font-serif font-semibold', DIRECTION_META[dominant.key].textColor)}>
              {COMPASS_LABELS[dominant.key]}
            </p>
            <p className="text-[8px] sm:text-[10px] text-white/50">{Math.round(dominant.pct * 100)}%</p>
          </div>
        </div>
      </div>

      {/* Directional arms */}
      {directions.map(d => {
        if (d.value === 0) return null;
        const isVertical = d.key === 'north' || d.key === 'south';
        const barLen = Math.max(28, Math.round(d.pct * 80));

        return (
          <div key={d.key} className={cn('absolute flex gap-2', d.meta.posClass)}>
            <div
              className={cn(d.meta.barClass, d.meta.color, 'opacity-80 transition-all duration-1000', d.meta.glowColor)}
              style={isVertical ? { height: `${barLen}px`, width: '4px' } : { width: `${barLen}px`, height: '4px' }}
            />
            {!silentMode && (
              <div className="flex flex-col items-center gap-0.5">
                <span className={cn('text-[9px] sm:text-[11px] font-serif font-medium drop-shadow-md', d.meta.textColor)}>
                  {COMPASS_LABELS[d.key]}
                </span>
                <span className="text-[8px] sm:text-[9px] text-white/50 drop-shadow-sm">
                  {d.value} signal{d.value !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Narrative at bottom — raised above warmth legend */}
      {!silentMode && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[280px] text-center px-2">
          <p className="text-[10px] font-serif italic text-white/50 leading-relaxed drop-shadow-sm">
            {COMPASS_NARRATIVES[dominant.key]}
          </p>
        </div>
      )}
    </div>
  );
}

/** Compact compass badge for marketing embeds — anonymized directional motion only. */
export function CompassEmbedIndicator({ weights }: { weights: CompassWeight }) {
  const total = weights.north + weights.east + weights.south + weights.west;
  if (total === 0) return null;

  const bars = [
    { key: 'N', value: weights.north, color: 'bg-amber-300/40' },
    { key: 'E', value: weights.east, color: 'bg-sky-300/40' },
    { key: 'S', value: weights.south, color: 'bg-emerald-300/40' },
    { key: 'W', value: weights.west, color: 'bg-rose-300/40' },
  ];

  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map(b => (
        <div
          key={b.key}
          className={cn('w-1 rounded-full', b.color)}
          style={{ height: `${Math.max(15, (b.value / total) * 100)}%` }}
        />
      ))}
    </div>
  );
}
