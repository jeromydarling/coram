import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/hooks/useCalendarData';
import { DayEventsPopover } from './DayEventsPopover';

interface CalendarMonthViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  isLoading?: boolean;
}

export function CalendarMonthView({
  currentDate,
  onDateChange,
  events,
  onEventClick,
  onDateClick,
  isLoading
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };
  
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateChange(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onDateChange(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateChange(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[120px] p-2 border-b border-r border-border cursor-pointer transition-colors hover:bg-muted/50',
                !isCurrentMonth && 'bg-muted/30',
                index % 7 === 6 && 'border-r-0'
              )}
              onClick={() => onDateClick(day)}
            >
              <div className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full text-sm mb-1',
                isToday(day) && 'bg-primary text-primary-foreground font-bold',
                !isCurrentMonth && 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    className={cn(
                      'w-full text-left text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1',
                      'hover:opacity-80 transition-opacity'
                    )}
                    style={{ 
                      backgroundColor: `${event.color}20`,
                      color: event.color
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    {event.metadata.isExternal ? (
                      <span className="text-[10px] font-bold flex-shrink-0">G</span>
                    ) : event.metadata.googleSynced ? (
                      <Cloud className="w-2.5 h-2.5 flex-shrink-0" />
                    ) : null}
                    <span className="truncate">{event.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <DayEventsPopover
                    day={day}
                    events={dayEvents}
                    overflowCount={dayEvents.length - 3}
                    onEventClick={onEventClick}
                    onScheduleClick={onDateClick}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
