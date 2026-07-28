/**
 * ListPageSkeleton — Reusable skeleton loader for list pages.
 *
 * WHAT: Shows pulsing skeleton UI while list data is loading.
 * WHERE: Used in contacts, opportunities, activities, and any paginated list page.
 * WHY: Skeleton loaders prevent jarring empty→full state transitions.
 */
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ListPageSkeletonProps {
  /** Number of skeleton rows to show */
  rows?: number;
  /** Show a filter bar skeleton */
  showFilters?: boolean;
  /** Show a header/stats bar skeleton */
  showStats?: boolean;
  /** Layout variant */
  variant?: 'table' | 'card';
}

export function ListPageSkeleton({
  rows = 6,
  showFilters = true,
  showStats = true,
  variant = 'table',
}: ListPageSkeletonProps) {
  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {showStats && (
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
          ))}
        </div>
      )}

      {/* Filter bar */}
      {showFilters && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24 ml-auto" />
        </div>
      )}

      {/* Content */}
      {variant === 'table' ? (
        <div className="rounded-lg border">
          {/* Header row */}
          <div className="flex items-center gap-4 p-3 border-b bg-muted/30">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
          {/* Data rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 border-b last:border-b-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-28" style={{ width: `${80 + Math.random() * 60}px` }} />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2 mt-1" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2 mt-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DetailPageSkeleton — Skeleton for entity detail / drawer views.
 */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title area */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-start">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DashboardSkeleton — Skeleton for the command center / dashboard.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
