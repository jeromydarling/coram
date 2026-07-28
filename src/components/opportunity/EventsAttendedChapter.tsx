import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Feather, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface EventsAttendedChapterProps {
  opportunityId: string;
}

interface AttendedEvent {
  id: string;
  event_name: string;
  event_date: string;
  city: string | null;
  attended_at: string | null;
  reflection_count: number;
  safe_summary: string | null;
}

export function EventsAttendedChapter({ opportunityId }: EventsAttendedChapterProps) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['events-attended-for-opp', opportunityId],
    queryFn: async (): Promise<AttendedEvent[]> => {
      if (!opportunityId) return [];

      // Events linked via host_opportunity_id where attended
      const { data: hostedEvents } = await supabase
        .from('events')
        .select('id, event_name, event_date, city, attended_at')
        .eq('host_opportunity_id', opportunityId)
        .not('attended_at', 'is', null)
        .order('event_date', { ascending: false })
        .limit(20);

      // Events linked via event_reflections.opportunity_id
      const { data: reflectionLinks } = await supabase
        .from('event_reflections')
        .select('event_id')
        .eq('opportunity_id', opportunityId);

      const reflectionEventIds = [...new Set((reflectionLinks ?? []).map((r: any) => r.event_id))];
      
      let reflectedEvents: any[] = [];
      if (reflectionEventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('id, event_name, event_date, city, attended_at')
          .in('id', reflectionEventIds)
          .order('event_date', { ascending: false })
          .limit(20);
        reflectedEvents = data ?? [];
      }

      // Merge and dedupe
      const allEvents = [...(hostedEvents ?? []), ...reflectedEvents];
      const seen = new Set<string>();
      const unique = allEvents.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      // Get reflection extractions for safe summaries
      const eventIds = unique.map(e => e.id);
      let extractionMap: Record<string, string> = {};
      if (eventIds.length > 0) {
        const { data: reflections } = await supabase
          .from('event_reflections')
          .select('event_id, id')
          .in('event_id', eventIds)
          .eq('visibility', 'team');
        
        if (reflections && reflections.length > 0) {
          const reflectionIds = reflections.map((r: any) => r.id);
          const { data: extractions } = await supabase
            .from('event_reflection_extractions')
            .select('reflection_id, summary_safe')
            .in('reflection_id', reflectionIds);
          
          // Map event_id → summary_safe (first one)
          const refToEvent = new Map((reflections as any[]).map(r => [r.id, r.event_id]));
          for (const ext of (extractions ?? []) as any[]) {
            const eventId = refToEvent.get(ext.reflection_id);
            if (eventId && !extractionMap[eventId] && ext.summary_safe) {
              extractionMap[eventId] = ext.summary_safe;
            }
          }
        }
      }

      // Get reflection counts
      let countMap: Record<string, number> = {};
      if (eventIds.length > 0) {
        const { data: counts } = await supabase
          .from('event_reflections')
          .select('event_id')
          .in('event_id', eventIds);
        for (const r of (counts ?? []) as any[]) {
          countMap[r.event_id] = (countMap[r.event_id] || 0) + 1;
        }
      }

      return unique.map(e => ({
        ...e,
        reflection_count: countMap[e.id] || 0,
        safe_summary: extractionMap[e.id] || null,
      }));
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || !events || events.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Events we showed up for
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {events.map(event => (
          <div
            key={event.id}
            className="flex items-start gap-3 p-2 rounded-lg border border-border/30 bg-muted/20"
          >
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{event.event_name}</span>
                <Badge className="bg-green-500/10 text-green-700 border-green-500/20 text-[10px] h-4 px-1 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                  Attended
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(event.event_date), 'MMM d, yyyy')}
                </span>
                {event.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {event.city}
                  </span>
                )}
                {event.reflection_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Feather className="w-3 h-3" />
                    {event.reflection_count} reflection{event.reflection_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {event.safe_summary && (
                <p className="text-[11px] text-muted-foreground/80 italic line-clamp-2 mt-1">
                  {event.safe_summary}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
