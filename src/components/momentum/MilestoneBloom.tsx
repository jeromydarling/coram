import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MilestoneBloomProps {
  metroId: string;
  achieved: boolean;
  className?: string;
}

// Track which milestones have been "seen" this session
const seenMilestones = new Set<string>();

export function MilestoneBloom({ metroId, achieved, className }: MilestoneBloomProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasBeenSeen, setHasBeenSeen] = useState(seenMilestones.has(metroId));

  useEffect(() => {
    if (achieved && !seenMilestones.has(metroId)) {
      setIsAnimating(true);
      seenMilestones.add(metroId);
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setHasBeenSeen(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [achieved, metroId]);

  if (!achieved) return null;

  return (
    <div
      className={cn(
        'absolute -top-1 -right-1 pointer-events-none',
        className
      )}
    >
      {isAnimating ? (
        // Bloom animation
        <div className="relative">
          <Star
            className="w-4 h-4 text-amber-500 fill-amber-500 animate-ping absolute"
            style={{ animationDuration: '1s' }}
          />
          <Star
            className="w-4 h-4 text-amber-500 fill-amber-500 relative z-10"
          />
          {/* Particle effects */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-400 rounded-full animate-ping"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${i * 60}deg) translateY(-12px)`,
                animationDelay: `${i * 100}ms`,
                animationDuration: '1.5s',
              }}
            />
          ))}
        </div>
      ) : (
        // Persistent subtle marker
        <Star
          className="w-3 h-3 text-amber-500 fill-amber-500 drop-shadow-sm"
        />
      )}
    </div>
  );
}
