import { useState } from 'react';
import { useTenantPath } from '@/hooks/useTenantPath';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar,
  Users,
  CheckSquare,
  MapPin,
  Clock,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { useWeeklySnapshot, DaySnapshot, UpcomingEvent, UpcomingMeeting, UpcomingTask, UpcomingGoogleEvent } from '@/hooks/useWeeklySnapshot';
import { useMetros } from '@/hooks/useMetros';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { sanitizeEventDescription } from '@/lib/sanitizeDescription';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GoogleEventManager } from '@/components/dashboard/GoogleEventManager';

interface QuickViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'event' | 'meeting' | 'task' | 'googleEvent';
  item: UpcomingEvent | UpcomingMeeting | UpcomingTask | UpcomingGoogleEvent | null;
  onNavigate: () => void;
}

function QuickViewModal({ open, onOpenChange, type, item, onNavigate }: QuickViewModalProps) {
  const { t } = useTranslation('dashboard');

  if (!item) return null;

  const renderContent = () => {
    if (type === 'event') {
      const event = item as UpcomingEvent;
      return (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-warning" />
              {event.event_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {format(parseISO(event.event_date), 'EEEE, MMMM d, yyyy')}
            </div>
            {(event.city || event.metro) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {event.city || event.metro}
              </div>
            )}
            {event.event_type && (
              <Badge variant="secondary">{event.event_type}</Badge>
            )}
            {event.status && (
              <Badge variant="outline">{event.status}</Badge>
            )}
          </div>
        </>
      );
    }

    if (type === 'meeting') {
      const meeting = item as UpcomingMeeting;
      return (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {meeting.activity_type}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {format(parseISO(meeting.activity_date_time), 'EEEE, MMMM d, yyyy @ h:mm a')}
            </div>
            {meeting.contact_name && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('snapshot.contact')}</span>{' '}
                <span className="font-medium">{meeting.contact_name}</span>
              </div>
            )}
            {meeting.organization && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('snapshot.organization')}</span>{' '}
                <span className="font-medium">{meeting.organization}</span>
              </div>
            )}
            {meeting.notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('snapshot.notes')}</span>
                <p className="mt-1">{meeting.notes}</p>
              </div>
            )}
          </div>
        </>
      );
    }

    if (type === 'task') {
      const task = item as UpcomingTask;
      return (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-success" />
              {task.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {t('snapshot.due')} {format(parseISO(task.due_date), 'EEEE, MMMM d, yyyy')}
            </div>
            {task.contact_name && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('snapshot.contact')}</span>{' '}
                <span className="font-medium">{task.contact_name}</span>
              </div>
            )}
            {task.organization && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('snapshot.organization')}</span>{' '}
                <span className="font-medium">{task.organization}</span>
              </div>
            )}
            {task.description && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('snapshot.description')}</span>
                <p className="mt-1">{task.description}</p>
              </div>
            )}
          </div>
        </>
      );
    }

    if (type === 'googleEvent') {
      const googleEvent = item as UpcomingGoogleEvent;
      return (
        <>
          <DialogHeader className="overflow-hidden">
            <DialogTitle className="flex items-center gap-2 min-w-0">
              <Calendar className="w-5 h-5 shrink-0" style={{ color: 'hsl(280 60% 55%)' }} />
              <span className="break-words">{googleEvent.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 w-full overflow-hidden">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {format(parseISO(googleEvent.start_time), 'EEEE, MMMM d, yyyy @ h:mm a')}
            </div>
            {googleEvent.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {googleEvent.location}
              </div>
            )}
            {googleEvent.description && (() => {
              const cleanDescription = sanitizeEventDescription(googleEvent.description);
              return cleanDescription ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('snapshot.description')}</span>
                  <div className="mt-1 max-h-24 overflow-y-auto border rounded-md bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {cleanDescription}
                    </p>
                  </div>
                </div>
              ) : null;
            })()}
            <Badge variant="secondary" className="gap-1">
              <span className="font-bold text-[10px]">G</span>
              {t('snapshot.googleCalendar')}
            </Badge>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <div className="w-full overflow-hidden">
          {renderContent()}
        </div>
        <div className="flex justify-end pt-4 w-full">
          <Button onClick={onNavigate} className="gap-2">
            <ExternalLink className="w-4 h-4" />
            {t('snapshot.viewFullDetails')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DayCardProps {
  day: DaySnapshot;
  onEventClick: (event: UpcomingEvent) => void;
  onMeetingClick: (meeting: UpcomingMeeting) => void;
  onTaskClick: (task: UpcomingTask) => void;
  onGoogleEventClick: (googleEvent: UpcomingGoogleEvent) => void;
}

function DayCard({ day, onEventClick, onMeetingClick, onTaskClick, onGoogleEventClick }: DayCardProps) {
  const { t } = useTranslation('dashboard');
  const hasItems = day.events.length > 0 || day.meetings.length > 0 || day.tasks.length > 0 || day.googleEvents.length > 0;
  const isToday = day.dayLabel === 'Today';
  const isTomorrow = day.dayLabel === 'Tomorrow';

  return (
    <TooltipProvider>
      <div className={cn(
        "rounded-lg border p-4 space-y-3 transition-all",
        isToday && "border-primary bg-primary/5",
        isTomorrow && "border-info/50 bg-info/5",
        !isToday && !isTomorrow && "border-border bg-card"
      )}>
      <div className="flex items-center justify-between">
        <h4 className={cn(
          "font-semibold text-sm",
          isToday && "text-primary",
          isTomorrow && "text-info"
        )}>
          {day.dayLabel}
        </h4>
        <span className="text-xs text-muted-foreground">
          {format(parseISO(day.date), 'MMM d')}
        </span>
      </div>

      {!hasItems ? (
        <p className="text-xs text-muted-foreground italic py-2">{t('snapshot.noScheduledItems')}</p>
      ) : (
        <div className="space-y-2">
          {/* Events */}
          {day.events.map(event => (
            <div
              key={event.id}
              onClick={() => onEventClick(event)}
              className="flex items-start gap-2 p-2 rounded-md bg-warning/10 hover:bg-warning/20 cursor-pointer transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs font-medium leading-tight line-clamp-2 cursor-pointer">{event.event_name}</p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>{event.event_name}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-2 flex-wrap">
                  {event.event_type && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {event.event_type}
                    </Badge>
                  )}
                  {(event.city || event.metro) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.city || event.metro}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Meetings */}
          {day.meetings.map(meeting => (
            <div
              key={meeting.id}
              onClick={() => onMeetingClick(meeting)}
              className="flex items-start gap-2 p-2 rounded-md bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs font-medium truncate cursor-pointer">
                      {meeting.activity_type}: {meeting.contact_name || meeting.organization || 'Meeting'}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>{meeting.activity_type}: {meeting.contact_name || meeting.organization || 'Meeting'}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(parseISO(meeting.activity_date_time), 'h:mm a')}
                </p>
              </div>
            </div>
          ))}

          {/* Tasks */}
          {day.tasks.map(task => (
            <div
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="flex items-start gap-2 p-2 rounded-md bg-success/10 hover:bg-success/20 cursor-pointer transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs font-medium truncate cursor-pointer">{task.title}</p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>{task.title}</p>
                  </TooltipContent>
                </Tooltip>
                {(task.contact_name || task.organization) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {task.contact_name && task.organization
                      ? `${task.contact_name} · ${task.organization}`
                      : task.contact_name || task.organization}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Google Calendar Events */}
          {day.googleEvents.map(googleEvent => (
            <div
              key={googleEvent.id}
              onClick={() => onGoogleEventClick(googleEvent)}
              className="flex items-start gap-2 p-2 rounded-md hover:opacity-80 cursor-pointer transition-colors"
              style={{ backgroundColor: 'hsl(280 60% 55% / 0.1)' }}
            >
              <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'hsl(280 60% 55%)' }} />
              <div className="min-w-0 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs font-medium truncate cursor-pointer flex items-center gap-1">
                      <span className="text-[10px] font-bold" style={{ color: 'hsl(280 60% 55%)' }}>G</span>
                      {googleEvent.title}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>{googleEvent.title}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(parseISO(googleEvent.start_time), 'h:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}

export function WeeklySnapshot() {
  const [metroFilter, setMetroFilter] = useState<string | null>(null);
  const [visibleCategories, setVisibleCategories] = useState({
    events: true,
    meetings: true,
    tasks: true,
    googleEvents: true,
  });
  const { data, isLoading } = useWeeklySnapshot(metroFilter);
  const { data: metros } = useMetros();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  const { t } = useTranslation('dashboard');

  // Modal states
  const [selectedItem, setSelectedItem] = useState<{
    type: 'event' | 'meeting' | 'task' | 'googleEvent';
    item: UpcomingEvent | UpcomingMeeting | UpcomingTask | UpcomingGoogleEvent;
  } | null>(null);

  const toggleCategory = (category: 'events' | 'meetings' | 'tasks' | 'googleEvents') => {
    setVisibleCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Filter days based on visible categories
  const filteredData = data ? {
    ...data,
    days: data.days.map(day => ({
      ...day,
      events: visibleCategories.events ? day.events : [],
      meetings: visibleCategories.meetings ? day.meetings : [],
      tasks: visibleCategories.tasks ? day.tasks : [],
      googleEvents: visibleCategories.googleEvents ? day.googleEvents : [],
    })),
  } : null;

  const handleEventClick = (event: UpcomingEvent) => {
    setSelectedItem({ type: 'event', item: event });
  };

  const handleMeetingClick = (meeting: UpcomingMeeting) => {
    setSelectedItem({ type: 'meeting', item: meeting });
  };

  const handleTaskClick = (task: UpcomingTask) => {
    setSelectedItem({ type: 'task', item: task });
  };

  const handleGoogleEventClick = (googleEvent: UpcomingGoogleEvent) => {
    setSelectedItem({ type: 'googleEvent', item: googleEvent });
  };

  const handleNavigate = () => {
    if (!selectedItem) return;

    setSelectedItem(null);

    if (selectedItem.type === 'event') {
      const event = selectedItem.item as UpcomingEvent;
      // Use native navigation for event detail pages to ensure proper routing
      window.location.href = tenantPath(`/events/${event.id}`);
    } else if (selectedItem.type === 'meeting') {
      const meeting = selectedItem.item as UpcomingMeeting;
      navigate(`/calendar?activity=${meeting.id}`);
    } else if (selectedItem.type === 'task') {
      const task = selectedItem.item as UpcomingTask;
      navigate(`/people?contact=${task.contact_id}`);
    } else if (selectedItem.type === 'googleEvent') {
      // Navigate to calendar for google events
      navigate('/calendar');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t('snapshot.weeklySnapshot')}
              <HelpTooltip contentKey="card.weekly-snapshot" />
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
              {/* Metro Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={metroFilter || "all"}
                  onValueChange={(value) => setMetroFilter(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder={t('snapshot.allMetros')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('snapshot.allMetros')}</SelectItem>
                    {metros?.map((metro) => (
                      <SelectItem key={metro.id} value={metro.id}>
                        {metro.metro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Legend - Clickable filters */}
              <button
                onClick={() => toggleCategory('events')}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer",
                  visibleCategories.events
                    ? "bg-warning/10 hover:bg-warning/20"
                    : "opacity-50 hover:opacity-75"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full bg-warning", !visibleCategories.events && "opacity-50")} />
                <span className="text-muted-foreground">{data?.totals.events || 0} {t('snapshot.events')}</span>
              </button>
              <button
                onClick={() => toggleCategory('meetings')}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer",
                  visibleCategories.meetings
                    ? "bg-primary/10 hover:bg-primary/20"
                    : "opacity-50 hover:opacity-75"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full bg-primary", !visibleCategories.meetings && "opacity-50")} />
                <span className="text-muted-foreground">{data?.totals.meetings || 0} {t('snapshot.meetings')}</span>
              </button>
              <button
                onClick={() => toggleCategory('tasks')}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer",
                  visibleCategories.tasks
                    ? "bg-success/10 hover:bg-success/20"
                    : "opacity-50 hover:opacity-75"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full bg-success", !visibleCategories.tasks && "opacity-50")} />
                <span className="text-muted-foreground">{data?.totals.tasks || 0} {t('snapshot.tasks')}</span>
              </button>
              <button
                onClick={() => toggleCategory('googleEvents')}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer",
                  visibleCategories.googleEvents
                    ? "hover:opacity-80"
                    : "opacity-50 hover:opacity-75"
                )}
                style={{ backgroundColor: visibleCategories.googleEvents ? 'hsl(280 60% 55% / 0.1)' : undefined }}
              >
                <span
                  className={cn("w-2.5 h-2.5 rounded-full", !visibleCategories.googleEvents && "opacity-50")}
                  style={{ backgroundColor: 'hsl(280 60% 55%)' }}
                />
                <span className="text-muted-foreground">{data?.totals.googleEvents || 0} {t('snapshot.google')}</span>
              </button>
              <GoogleEventManager />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {filteredData?.days.map(day => (
                <DayCard
                  key={day.date}
                  day={day}
                  onEventClick={handleEventClick}
                  onMeetingClick={handleMeetingClick}
                  onTaskClick={handleTaskClick}
                  onGoogleEventClick={handleGoogleEventClick}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Quick View Modal */}
      <QuickViewModal
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        type={selectedItem?.type || 'event'}
        item={selectedItem?.item || null}
        onNavigate={handleNavigate}
      />
    </>
  );
}
