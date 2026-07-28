import { 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  addWeeks,
  subWeeks
} from 'date-fns';
import { ChevronLeft, ChevronRight, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/hooks/useCalendarData';
import { ScrollArea } from '@/components/ui/scroll-area';

// Helper to format event time from date
function formatEventTime(event: CalendarEvent): string | null {
  const hours = event.date.getHours();
  const minutes = event.date.getMinutes();
  
  // If it's midnight (00:00), likely an all-day event
  if (hours === 0 && minutes === 0) return null;
  
  return format(event.date, 'h:mm a');
}

interface CalendarWeekViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  selectedDay: Date | null;
  onDaySelect: (date: Date) => void;
}

export function CalendarWeekView({
  currentDate,
  onDateChange,
  events,
  onEventClick,
  onDateClick,
  selectedDay,
  onDaySelect
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const activeDay = selectedDay || new Date();
  
  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };
  
  const dayEvents = getEventsForDay(activeDay);
  
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDateChange(subWeeks(currentDate, 1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <div className="text-sm font-medium text-foreground">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDateChange(addWeeks(currentDate, 1))}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Week day selector */}
      <div className="grid grid-cols-7 border-b border-border flex-shrink-0">
        {days.map(day => {
          const dayEventCount = getEventsForDay(day).length;
          const isSelected = isSameDay(day, activeDay);
          
          return (
            <button
              key={day.toISOString()}
              className={cn(
                'flex flex-col items-center py-3 px-1 transition-colors',
                isSelected && 'bg-primary/10',
                !isSelected && 'hover:bg-muted/50'
              )}
              onClick={() => onDaySelect(day)}
            >
              <span className="text-[10px] uppercase text-muted-foreground font-medium">
                {format(day, 'EEE')}
              </span>
              <span className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium mt-1',
                isToday(day) && 'bg-primary text-primary-foreground',
                isSelected && !isToday(day) && 'bg-primary/20 text-primary',
              )}>
                {format(day, 'd')}
              </span>
              {dayEventCount > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {Array.from({ length: Math.min(dayEventCount, 3) }).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Today button */}
      <div className="p-2 border-b border-border flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onDateChange(new Date());
            onDaySelect(new Date());
          }}
        >
          Today
        </Button>
      </div>
      
      {/* Selected day events */}
      <div className="flex-1 overflow-hidden">
        <div className="p-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-foreground">
            {format(activeDay, 'EEEE, MMMM d')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
          </p>
        </div>
        
        <ScrollArea className="h-[calc(100%-60px)]">
          <div className="p-3 space-y-2">
            {dayEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No events scheduled</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => onDateClick(activeDay)}
                >
                  + Schedule a meeting
                </Button>
              </div>
            ) : (
              dayEvents.map(event => (
                <button
                  key={event.id}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    'hover:bg-muted/50 active:bg-muted'
                  )}
                  style={{ 
                    borderLeftWidth: '4px',
                    borderLeftColor: event.color
                  }}
                  onClick={() => onEventClick(event)}
                >
                  <div className="flex items-start gap-2">
                    {event.metadata.isExternal ? (
                      <span className="text-xs font-bold text-muted-foreground flex-shrink-0 mt-0.5">G</span>
                    ) : event.metadata.googleSynced ? (
                      <Cloud className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground line-clamp-2">
                        {event.title}
                      </h4>
                      {formatEventTime(event) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatEventTime(event)}
                        </p>
                      )}
                      {event.metadata.location && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          📍 {event.metadata.location}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
