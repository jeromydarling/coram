import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Radio, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHomeMetro } from '@/hooks/useHomeMetro';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTranslation } from 'react-i18next';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';

export function LocalPulseCard() {
  const { data: homeMetroId } = useHomeMetro();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  const { t } = useTranslation('dashboard');

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { data: events, isLoading } = useQuery({
    queryKey: ['local-pulse-dashboard', homeMetroId],
    queryFn: async () => {
      if (!homeMetroId) return [];
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, city, host_organization')
        .eq('metro_id', homeMetroId)
        .eq('is_local_pulse', true)
        .gte('event_date', weekStart.toISOString().split('T')[0])
        .lte('event_date', weekEnd.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!homeMetroId,
  });

  // Don't render if no home metro or no events
  if (!homeMetroId || (!isLoading && (!events || events.length === 0))) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="w-4 h-4 text-primary" />
          {t('localPulse.title')}
          <HelpTooltip contentKey="card.local-pulse" />
          {events && events.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {t('localPulse.thisWeek', { count: events.length })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            {events?.map(event => (
              <div
                key={event.id}
                className="flex items-start gap-2 p-2 rounded-lg border border-border/50 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{event.event_name}</p>
                  <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                    {event.event_date && (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {format(parseISO(event.event_date), 'EEE, MMM d')}
                      </span>
                    )}
                    {event.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {event.city}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs gap-1 text-primary"
              onClick={() => navigate(tenantPath('/events/find?tab=pulse'))}
            >
              {t('localPulse.reviewAll')}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
