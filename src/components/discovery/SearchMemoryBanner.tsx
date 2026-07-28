import { History } from 'lucide-react';

interface SearchMemoryBannerProps {
  mergedCount: number;
  priorRunsMerged: number;
}

export function SearchMemoryBanner({ mergedCount, priorRunsMerged }: SearchMemoryBannerProps) {
  if (mergedCount <= 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
      <History className="w-3.5 h-3.5 shrink-0" />
      <span>
        Results enriched from {priorRunsMerged} prior search{priorRunsMerged !== 1 ? 'es' : ''} ({mergedCount} additional result{mergedCount !== 1 ? 's' : ''} merged)
      </span>
    </div>
  );
}
