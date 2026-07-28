import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { parseISO, startOfToday } from 'date-fns';
import { 
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  UserPlus,
  TrendingUp,
  Flag
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EventContactStats } from '@/hooks/useEventContactsCount';

type GrantNarrativeValue = 'High' | 'Medium' | 'Low';

interface Event {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;
  metro_id?: string | null;
  event_type: string | null;
  staff_deployed?: number | null;
  households_served?: number | null;
  anchor_identified_yn?: boolean | null;
  grant_narrative_value?: GrantNarrativeValue | null;
  notes?: string | null;
  metros?: { metro: string } | null;
  contacts_made?: number;
  contacts_converted?: number;
  conversion_rate?: number;
  expected_households?: string | null;
  pcs_goals?: string[] | null;
}

interface EventCardProps {
  event: Event;
  onClick: () => void;
  className?: string;
  contactStats?: EventContactStats;
}

const getTypeBadge = (type: string | null) => {
  if (!type) return 'bg-muted text-muted-foreground border-border';
  return 'bg-primary/15 text-primary border-primary/30';
};

const getNarrativeValueColor = (value: GrantNarrativeValue | null | undefined) => {
  const styles: Record<string, string> = {
    'High': 'text-success',
    'Medium': 'text-warning',
    'Low': 'text-muted-foreground'
  };
  return value ? styles[value] : 'text-muted-foreground';
};

export function EventCard({ event, onClick, className, contactStats }: EventCardProps) {
  const { t } = useTranslation('events');
  const { enabled: metroEnabled } = useMetroIntelligence();
  const eventDate = parseISO(event.event_date);
  const isPastEvent = eventDate < startOfToday();
  const hasActualData = (event.households_served || 0) > 0;

  const monthAbbr = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const dayNum = eventDate.getDate();

  return (
    <div 
      className={cn(
        'bg-card rounded-xl border border-border cursor-pointer transition-all duration-200',
        'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
        'flex flex-col sm:flex-row overflow-hidden',
        className
      )}
      onClick={onClick}
    >
      {/* Date Header (Mobile) / Date Column (Desktop) */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 sm:flex-col sm:items-center sm:justify-center sm:px-4 sm:py-3 sm:min-w-[72px] border-b sm:border-b-0 sm:border-r",
        isPastEvent 
          ? "bg-muted/50 border-border" 
          : "bg-primary/10 border-primary/20"
      )}>
        <div className="flex items-center gap-2 sm:hidden">
          <span className={cn(
            "text-lg font-bold",
            isPastEvent ? "text-muted-foreground" : "text-primary"
          )}>
            {monthAbbr} {dayNum}, {eventDate.getFullYear()}
          </span>
        </div>
        
        <div className="hidden sm:flex sm:flex-col sm:items-center">
          <span className={cn(
            "text-xs font-bold uppercase tracking-wider",
            isPastEvent ? "text-muted-foreground" : "text-primary"
          )}>
            {monthAbbr}
          </span>
          <span className={cn(
            "text-3xl font-bold leading-none",
            isPastEvent ? "text-muted-foreground" : "text-primary"
          )}>
            {dayNum}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {eventDate.getFullYear()}
          </span>
        </div>
        
        <Badge variant="outline" className={cn('text-xs sm:hidden', getTypeBadge(event.event_type))}>
          {event.event_type || t('eventCard.noType')}
        </Badge>
      </div>

      {/* Content Column */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm sm:text-base line-clamp-2 sm:truncate">{event.event_name}</h3>
            {metroEnabled && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{event.metros?.metro || t('eventCard.noMetro')}</span>
              </div>
            )}
          </div>
          {event.anchor_identified_yn ? (
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-muted shrink-0" />
          )}
        </div>

        {/* Type Badge - Desktop only */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('text-xs', getTypeBadge(event.event_type))}>
            {event.event_type || t('eventCard.noType')}
          </Badge>
          {event.pcs_goals && event.pcs_goals.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary gap-1">
              <Flag className="w-2.5 h-2.5" />
              {event.pcs_goals[0]}
              {event.pcs_goals.length > 1 && ` +${event.pcs_goals.length - 1}`}
            </Badge>
          )}
        </div>

        {/* Stats: Attended + Staff */}
        <div className="grid grid-cols-2 gap-1 pt-2 border-t border-border">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
            </div>
            {isPastEvent || hasActualData ? (
              <>
                <p className="text-base sm:text-lg font-bold text-foreground">{event.households_served || 0}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">{t('eventCard.attended')}</p>
              </>
            ) : (
              <>
                <p className="text-base sm:text-lg font-bold text-foreground/70">{event.expected_households || '—'}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">{t('eventCard.expected')}</p>
              </>
            )}
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-warning" />
            </div>
            <p className="text-base sm:text-lg font-bold text-foreground">{event.staff_deployed || 0}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">{t('eventCard.staff')}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {(event.contacts_made ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="font-medium">{event.contacts_made}</span>
                {(event.conversion_rate ?? 0) > 0 && (
                  <span className="flex items-center text-success text-[10px]">
                    <TrendingUp className="w-3 h-3" />
                    {event.conversion_rate?.toFixed(0)}%
                  </span>
                )}
              </span>
            )}
            {event.grant_narrative_value && (
              <span className={cn('font-medium whitespace-nowrap', getNarrativeValueColor(event.grant_narrative_value))}>
                {event.grant_narrative_value}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
