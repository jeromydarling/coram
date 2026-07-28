import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { Eye, EyeOff, Calendar, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useWeeklyGoogleEvents, useToggleGoogleEventHidden } from '@/hooks/useHiddenGoogleEvents';

export function GoogleEventManager() {
  const { t } = useTranslation('dashboard');
  const [open, setOpen] = useState(false);
  const { data: events, isLoading } = useWeeklyGoogleEvents();
  const toggleHidden = useToggleGoogleEventHidden();

  const visibleCount = events?.filter(e => !e.hidden).length ?? 0;
  const hiddenCount = events?.filter(e => e.hidden).length ?? 0;

  // Group events by day
  const groupedByDay = (events || []).reduce<Record<string, typeof events>>((acc, event) => {
    const dayKey = format(parseISO(event.start_time), 'yyyy-MM-dd');
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey]!.push(event);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="w-4 h-4" style={{ color: 'hsl(280 60% 55%)' }} />
          <span className="hidden sm:inline">{t('googleEventManager.manageGoogleEvents')}</span>
          <span className="sm:hidden">{t('googleEventManager.googleEvents')}</span>
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {t('googleEventManager.hiddenCount', { count: hiddenCount })}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: 'hsl(280 60% 55%)' }} />
            {t('snapshot.googleCalendar')}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {t('googleEventManager.toggleVisibilityDescription')}
          </p>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-primary" /> {t('googleEventManager.visibleCount', { count: visibleCount })}
            </span>
            <span className="flex items-center gap-1">
              <EyeOff className="w-3 h-3 text-muted-foreground" /> {t('googleEventManager.hiddenCount', { count: hiddenCount })}
            </span>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !events?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('googleEventManager.noEventsThisWeek')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedByDay).map(([dayKey, dayEvents]) => (
                <div key={dayKey}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {format(parseISO(dayKey), 'EEEE, MMM d')}
                  </h3>
                  <div className="space-y-2">
                    {dayEvents!.map(event => (
                      <div
                        key={event.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border transition-all',
                          event.hidden
                            ? 'opacity-50 bg-muted/30 border-border'
                            : 'bg-card border-border'
                        )}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className={cn(
                            'text-sm font-medium leading-tight',
                            event.hidden && 'line-through text-muted-foreground'
                          )}>
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(event.start_time), 'h:mm a')}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {event.hidden ? t('googleEventManager.hidden') : t('googleEventManager.visible')}
                          </span>
                          <Switch
                            checked={!event.hidden}
                            onCheckedChange={(checked) => {
                              toggleHidden.mutate({ id: event.id, hidden: !checked });
                            }}
                            disabled={toggleHidden.isPending}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
