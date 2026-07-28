/**
 * ImpulsusTimeline — infinite-scroll vertical list of scrapbook cards.
 *
 * WHAT: Renders ImpulsusCards with automatic loading of more entries on scroll.
 * WHERE: Main content area of the Impulsus page.
 * WHY: Provides the journal's timeline experience.
 */

import { useEffect, useRef, useCallback } from 'react';
import { ImpulsusCard } from './ImpulsusCard';
import { ImpulsusEmptyState } from './ImpulsusEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import type { ImpulsusEntry } from '@/hooks/useImpulsusEntries';

interface ImpulsusTimelineProps {
  entries: ImpulsusEntry[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

export function ImpulsusTimeline({
  entries,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: ImpulsusTimelineProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  if (isLoading) {
    return (
      <div className="columns-1 sm:columns-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl break-inside-avoid mb-3" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return <ImpulsusEmptyState />;
  }

  return (
    <div className="columns-1 sm:columns-2 gap-3">
      {entries.map((entry) => (
        <ImpulsusCard key={entry.id} entry={entry} />
      ))}
      {isFetchingNextPage && (
        <Skeleton className="h-28 w-full rounded-xl break-inside-avoid mb-3" />
      )}
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
}
