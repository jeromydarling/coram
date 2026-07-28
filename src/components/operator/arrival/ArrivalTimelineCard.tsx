/**
 * ArrivalTimelineCard — First 7-day narrative timeline for a new tenant.
 *
 * WHAT: Visual timeline of early adoption milestones from Testimonium events.
 * WHERE: /operator/nexus/arrival
 * WHY: Helps operator see early adoption without digging through data.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

interface ArrivalTimelineCardProps {
  tenantId: string;
  createdAt: string;
}

interface MilestoneItem {
  day: number;
  label: string;
  reached: boolean;
  reachedAt?: string;
}

export function ArrivalTimelineCard({ tenantId, createdAt }: ArrivalTimelineCardProps) {
  const { data: events } = useQuery({
    queryKey: ['arrival-timeline', tenantId],
    queryFn: async () => {
      const { data } = await (supabase
        .from('testimonium_events' as any)
        .select('event_type, created_at') as any)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
        .limit(50);
      return (data ?? []) as { event_type: string; created_at: string }[];
    },
  });

  const createdDate = parseISO(createdAt);
  const eventTypes = new Set((events ?? []).map((e) => e.event_type));
  const firstEvent = (type: string) => (events ?? []).find((e) => e.event_type === type);

  const milestones: MilestoneItem[] = [
    {
      day: 0,
      label: 'Signup',
      reached: true,
      reachedAt: createdAt,
    },
    {
      day: 1,
      label: 'First Login',
      reached: eventTypes.has('first_login') || eventTypes.has('user_login'),
      reachedAt: firstEvent('first_login')?.created_at || firstEvent('user_login')?.created_at,
    },
    {
      day: 2,
      label: 'First Reflection',
      reached: eventTypes.has('reflection_created'),
      reachedAt: firstEvent('reflection_created')?.created_at,
    },
    {
      day: 3,
      label: 'First Activity Logged',
      reached: eventTypes.has('activity_created') || eventTypes.has('activity_logged'),
      reachedAt: firstEvent('activity_created')?.created_at || firstEvent('activity_logged')?.created_at,
    },
    {
      day: 5,
      label: 'Narrative Signals Begin',
      reached: eventTypes.has('narrative_generated') || eventTypes.has('drift_detected'),
      reachedAt: firstEvent('narrative_generated')?.created_at || firstEvent('drift_detected')?.created_at,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          First 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-4">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />

          {milestones.map((m, i) => (
            <div key={i} className="relative flex items-start gap-3">
              <div className="absolute left-[-24px] mt-0.5">
                {m.reached ? (
                  <CheckCircle2 className="w-[18px] h-[18px] text-primary" />
                ) : (
                  <Circle className="w-[18px] h-[18px] text-muted-foreground/40" />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${m.reached ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Day {m.day} — {m.label}
                </p>
                {m.reached && m.reachedAt && (
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(m.reachedAt), 'MMM d, h:mm a')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
