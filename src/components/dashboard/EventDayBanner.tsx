/**
 * Event Day Banner
 *
 * Displayed at the top of Command Center when today is a conference day.
 * Clicking navigates to the Event Detail page.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';

interface EventDayBannerProps {
  events: Array<{
    id: string;
    event_name: string;
    slug: string | null;
    city: string | null;
    metros?: { metro: string } | null;
  }>;
}

export function EventDayBanner({ events }: EventDayBannerProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  if (events.length === 0) return null;

  // Show first event (if multiple, they're all active today)
  const event = events[0];
  const locationText = event.city || event.metros?.metro || null;

  const handleClick = () => {
    navigate(tenantPath(`/events/${event.slug || event.id}`));
  };

  return (
    <Card
      className="bg-gradient-to-r from-secondary/20 via-secondary/10 to-background border-secondary/30 cursor-pointer hover:border-secondary/50 transition-colors"
      onClick={handleClick}
    >
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-secondary/20">
            <Calendar className="w-5 h-5 text-secondary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
               <h3 className="font-semibold text-sm text-secondary-foreground">{t('eventDayBanner.todayIsEventDay')}</h3>
               <HelpTooltip contentKey="card.event-day-banner" />
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="font-medium truncate">{event.event_name}</span>
              {locationText && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {locationText}
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
