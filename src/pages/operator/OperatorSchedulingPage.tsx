/**
 * OperatorSchedulingPage — Calendar/event scheduling for operators.
 *
 * WHAT: Calendar view with operator-specific event types + Guided Activation queue.
 * WHERE: /operator/scheduling
 * WHY: Operators need to schedule demos, outreach meetings, onboarding calls, and manage activation sessions.
 */
import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { useCalendarData } from '@/hooks/useCalendarData';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GuidedActivationQueue } from '@/components/operator/GuidedActivationQueue';

const EVENT_TYPE_LABELS: Record<string, string> = {
  outreach_meeting: 'Outreach Meeting',
  demo_session: 'Demo Session',
  onboarding_call: 'Onboarding Call',
  meeting: 'Meeting',
  call: 'Call',
  site_visit: 'Site Visit',
};

export default function OperatorSchedulingPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: calendarEvents, isLoading } = useCalendarData(currentDate);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    (calendarEvents || []).forEach((ev: any) => {
      const rawDate = ev.date ?? ev.event_date ?? ev.start_date;
      if (!rawDate) return; // skip entries with no date
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (isNaN(d.getTime())) return; // skip invalid dates
      const dateKey = format(d, 'yyyy-MM-dd');
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(ev);
    });
    return map;
  }, [calendarEvents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Scheduling</h1>
        <p className="text-sm text-muted-foreground">Gardener calendar for outreach, demos, and onboarding</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(dateKey) || [];
            const isToday = isSameDay(day, new Date());
            const inMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={dateKey}
                className={cn(
                  'min-h-[80px] md:min-h-[100px] border-t border-r border-border p-1',
                  !inMonth && 'bg-muted/20 opacity-50'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  isToday && 'bg-primary text-primary-foreground'
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev: any, i: number) => (
                    <div key={i} className="text-[10px] leading-tight bg-primary/10 text-primary rounded px-1 py-0.5 truncate">
                      {ev.event_name || EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operator event types reference */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">Event types:</span>
        {['outreach_meeting', 'demo_session', 'onboarding_call'].map((t) => (
          <Badge key={t} variant="outline">{EVENT_TYPE_LABELS[t]}</Badge>
        ))}
      </div>

      {/* Guided Activation Queue */}
      <GuidedActivationQueue />
    </div>
  );
}
