import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Feather, Mail, Megaphone, EyeOff, ChevronDown, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStoryEvents, type StoryEvent, type StoryEventKind } from '@/hooks/useStoryEvents';
import { Skeleton } from '@/components/ui/skeleton';

interface StoryTimelineProps {
  opportunityId: string;
}

const KIND_CONFIG: Record<StoryEventKind, { icon: typeof Feather; label: string; className: string }> = {
  reflection: { icon: Feather, label: 'Reflection', className: 'text-primary bg-primary/10' },
  task: { icon: CheckSquare, label: 'Task', className: 'text-success bg-success/10' },
  email: { icon: Mail, label: 'Email', className: 'text-info bg-info/10' },
  campaign: { icon: Megaphone, label: 'Campaign', className: 'text-warning bg-warning/10' },
};

const FILTERS: Array<{ value: StoryEventKind | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'reflection', label: 'Reflections' },
  { value: 'task', label: 'Tasks' },
  { value: 'email', label: 'Emails' },
  { value: 'campaign', label: 'Campaigns' },
];

export function StoryTimeline({ opportunityId }: StoryTimelineProps) {
  const [filter, setFilter] = useState<StoryEventKind | 'all'>('all');
  const [page, setPage] = useState(0);
  const { data: events = [], isLoading } = useStoryEvents(opportunityId, filter, page);

  // Accumulate pages client-side for "load more" UX
  const [allEvents, setAllEvents] = useState<StoryEvent[]>([]);

  // Reset accumulated events when filter changes
  const [activeFilter, setActiveFilter] = useState(filter);
  if (activeFilter !== filter) {
    setActiveFilter(filter);
    setAllEvents([]);
    setPage(0);
  }

  // Merge new page data with accumulated (dedup by id)
  const displayEvents = (() => {
    if (page === 0) return events;
    const merged = [...allEvents];
    const seen = new Set(merged.map(e => e.id));
    for (const e of events) {
      if (!seen.has(e.id)) {
        merged.push(e);
        seen.add(e.id);
      }
    }
    return merged;
  })();

  const handleLoadMore = () => {
    setAllEvents(displayEvents);
    setPage(p => p + 1);
  };

  const hasMore = events.length >= 50; // If we got a full page, there may be more

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      {isLoading && page === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : displayEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No story events yet. Add a reflection to begin the narrative.
        </p>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2 pr-2">
            {displayEvents.map(event => (
              <StoryEventCard key={event.id} event={event} />
            ))}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground gap-1"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                <ChevronDown className="w-3 h-3" />
                Load older events
              </Button>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function StoryEventCard({ event }: { event: StoryEvent }) {
  const config = KIND_CONFIG[event.kind];
  const Icon = config.icon;

  // Safe date formatting
  let timeLabel = '';
  if (event.occurred_at) {
    try {
      const d = new Date(event.occurred_at);
      if (Number.isFinite(d.getTime())) {
        timeLabel = formatDistanceToNow(d, { addSuffix: true });
      }
    } catch {
      // Ignore invalid dates
    }
  }

  return (
    <Card className="border-border/40">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', config.className)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground truncate">{event.title || 'Untitled'}</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{config.label}</Badge>
              {event.privacy === 'private' && (
                <EyeOff className="w-3 h-3 text-muted-foreground/50" />
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{event.summary || ''}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
              {event.author_label && <span>{event.author_label}</span>}
              {event.author_label && timeLabel && <span>·</span>}
              {timeLabel && <span>{timeLabel}</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
