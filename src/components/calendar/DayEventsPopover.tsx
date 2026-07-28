import { format } from 'date-fns';
import { Cloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/hooks/useCalendarData';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DayEventsPopoverProps {
  day: Date;
  events: CalendarEvent[];
  overflowCount: number;
  onEventClick: (event: CalendarEvent) => void;
  onScheduleClick: (date: Date) => void;
}

export function DayEventsPopover({
  day,
  events,
  overflowCount,
  onEventClick,
  onScheduleClick,
}: DayEventsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className="text-xs text-primary hover:text-primary/80 hover:underline px-1 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          +{overflowCount} more
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 bg-popover border border-border shadow-lg z-50" 
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-foreground">
            {format(day, 'EEEE, MMMM d')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </p>
        </div>
        
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-1">
            {events.map(event => (
              <button
                key={event.id}
                className={cn(
                  'w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-1.5',
                  'hover:bg-muted/50 transition-colors'
                )}
                style={{ 
                  borderLeft: `3px solid ${event.color}`,
                }}
                onClick={() => onEventClick(event)}
              >
                {event.metadata.isExternal ? (
                  <span className="text-[10px] font-bold text-muted-foreground flex-shrink-0">G</span>
                ) : event.metadata.googleSynced ? (
                  <Cloud className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                ) : null}
                <span className="truncate text-foreground">{event.title}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
        
        <div className="p-2 border-t border-border">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs"
            onClick={() => onScheduleClick(day)}
          >
            + Schedule a meeting
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
