import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink, EyeOff, CalendarPlus, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export interface LocalPulseEvent {
  id: string;
  event_name: string;
  event_date: string | null;
  end_date: string | null;
  city: string | null;
  host_organization: string | null;
  url: string | null;
  description: string | null;
  is_local_pulse: boolean;
  needs_review: boolean | null;
  date_confidence: string | null;
  extraction_status: string | null;
  metadata: { dismissed?: boolean } | null;
}

interface Props {
  event: LocalPulseEvent;
  onDismiss: (id: string) => void;
  onAdd?: (id: string) => void;
  /** If set, shows a countdown undo bar instead of the normal card content actions */
  pendingDismiss?: { secondsLeft: number; onUndo: () => void };
}

export function LocalPulseEventCard({ event, onDismiss, onAdd, pendingDismiss }: Props) {
  const { t } = useTranslation('events');
  const eventIsPast = (() => {
    if (!event.event_date) return false;
    const parsed = parseISO(event.event_date);
    const today = new Date();
    return (
      parsed.getFullYear() < today.getFullYear() ||
      (parsed.getFullYear() === today.getFullYear() && parsed.getMonth() < today.getMonth()) ||
      (parsed.getFullYear() === today.getFullYear() && parsed.getMonth() === today.getMonth() && parsed.getDate() < today.getDate())
    );
  })();

  if (pendingDismiss) {
    return (
      <Card className="opacity-60 border-dashed">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                <span className="font-medium">{event.event_name}</span> {t('pulseEventCard.dismissed')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1 shrink-0"
              onClick={pendingDismiss.onUndo}
            >
              {t('pulseEventCard.undo', { seconds: pendingDismiss.secondsLeft })}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={eventIsPast ? 'opacity-60' : ''}>
      <CardContent className="p-3">
        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium truncate">{event.event_name}</h4>
              {event.date_confidence === 'low' && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 text-yellow-600 border-yellow-400">
                  {t('pulseEventCard.needsReview')}
                </Badge>
              )}
              {event.extraction_status === 'pending' && (
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {t('pulseEventCard.processing')}
                </Badge>
              )}
              {event.extraction_status === 'failed' && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 text-destructive border-destructive/40">
                  {t('pulseEventCard.parseFailed')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {event.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(parseISO(event.event_date), 'MMM d, yyyy')}
                </span>
              )}
              {!event.event_date && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <Calendar className="w-3 h-3" />
                  {t('pulseEventCard.noDateFound')}
                </span>
              )}
              {event.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {event.city}
                </span>
              )}
            </div>
            {event.host_organization && (
              <p className="text-[11px] text-muted-foreground">{t('pulseEventCard.hostedBy', { host: event.host_organization })}</p>
            )}
            {event.description && (
              <p className="text-[11px] text-muted-foreground/80 line-clamp-2">{event.description}</p>
            )}
          </div>
          <div className="flex flex-row sm:flex-col gap-1 shrink-0">
            {event.url && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" asChild>
                <a href={event.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-2.5 h-2.5" />
                  {t('pulseEventCard.view')}
                </a>
              </Button>
            )}
            {!eventIsPast && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={() => onAdd?.(event.id)}
              >
                <CalendarPlus className="w-2.5 h-2.5" />
                {t('pulseEventCard.addEvent')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-muted-foreground"
              onClick={() => onDismiss(event.id)}
            >
              <EyeOff className="w-2.5 h-2.5" />
              {t('pulseEventCard.dismiss')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
