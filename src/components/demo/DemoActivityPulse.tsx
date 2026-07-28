/**
 * DemoActivityPulse — Simulated real-time activity feed for demo mode.
 *
 * WHAT: Animated notification feed that shows fictional community activity appearing in real time.
 * WHERE: Rendered on the Command Center when demo mode is active.
 * WHY: Makes the demo feel alive and inhabited — a real community using CROS.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Heart, MapPin, Phone, Mail, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimulatedEvent {
  id: number;
  icon: typeof Activity;
  text: string;
  time: string;
  type: 'reflection' | 'meeting' | 'contact' | 'pulse' | 'call' | 'email';
}

const EVENT_POOL: Omit<SimulatedEvent, 'id' | 'time'>[] = [
  { icon: Heart, text: 'Maria Johnson added a reflection on Community First Alliance', type: 'reflection' },
  { icon: Users, text: 'Discovery meeting held with Bridge Builders', type: 'meeting' },
  { icon: MapPin, text: 'New Local Pulse article found in Austin metro', type: 'pulse' },
  { icon: Phone, text: 'James Garcia logged a call with Neighborhood Connect', type: 'call' },
  { icon: Heart, text: 'Fatima Patel wrote a journey chapter for Pathways Hub', type: 'reflection' },
  { icon: Mail, text: 'Follow-up email sent to Rising Tide Foundation', type: 'email' },
  { icon: Users, text: 'Site visit scheduled with Lakeside Outreach', type: 'meeting' },
  { icon: MapPin, text: 'Community event discovered in Denver metro', type: 'pulse' },
  { icon: Heart, text: 'David Williams reflected on partnership growth with Unity Project', type: 'reflection' },
  { icon: Phone, text: 'Check-in call with Sunrise Community Center', type: 'call' },
  { icon: Users, text: 'Partner Breakfast attended — 12 orgs represented', type: 'meeting' },
  { icon: Heart, text: 'Keiko Chen noted movement in Digital Bridge Foundation relationship', type: 'reflection' },
  { icon: MapPin, text: 'Workforce development article flagged in Portland', type: 'pulse' },
  { icon: Mail, text: 'Intro email drafted for Common Ground', type: 'email' },
  { icon: Users, text: 'Quarterly Review with Metro Impact Partners completed', type: 'meeting' },
  { icon: Heart, text: 'Priya Lee shared gratitude for Crossroads Collective partnership', type: 'reflection' },
];

const TYPE_COLORS: Record<string, string> = {
  reflection: 'text-purple-500',
  meeting: 'text-blue-500',
  contact: 'text-emerald-500',
  pulse: 'text-amber-500',
  call: 'text-teal-500',
  email: 'text-sky-500',
};

function relativeTime(seconds: number): string {
  if (seconds < 60) return 'just now';
  if (seconds < 120) return '1 min ago';
  return `${Math.floor(seconds / 60)} min ago`;
}

export function DemoActivityPulse() {
  const { isDemoMode } = useDemoMode();
  const [events, setEvents] = useState<SimulatedEvent[]>([]);
  const [counter, setCounter] = useState(0);

  const addEvent = useCallback(() => {
    setCounter(prev => {
      const idx = prev % EVENT_POOL.length;
      const template = EVENT_POOL[idx];
      const newEvent: SimulatedEvent = {
        ...template,
        id: Date.now() + prev,
        time: new Date().toISOString(),
      };
      setEvents(curr => [newEvent, ...curr].slice(0, 8));
      return prev + 1;
    });
  }, []);

  useEffect(() => {
    if (!isDemoMode) return;

    // Add first event quickly
    const initialTimeout = setTimeout(addEvent, 3000);

    // Then add events at realistic intervals (20-45 seconds)
    const interval = setInterval(() => {
      addEvent();
    }, 20000 + Math.random() * 25000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isDemoMode, addEvent]);

  if (!isDemoMode || events.length === 0) return null;

  return (
    <Card className="border-primary/10 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="w-4 h-4 text-primary" />
          Community Activity
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {events.map((event, i) => {
          const Icon = event.icon;
          const ageSeconds = Math.floor((Date.now() - new Date(event.time).getTime()) / 1000);
          return (
            <div
              key={event.id}
              className={cn(
                'flex items-start gap-2.5 py-1.5 text-sm transition-all duration-500',
                i === 0 ? 'animate-fade-in' : 'opacity-70'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', TYPE_COLORS[event.type])} />
              <span className="flex-1 min-w-0 text-muted-foreground leading-snug truncate">
                {event.text}
              </span>
              <span className="text-xs text-muted-foreground/60 shrink-0 tabular-nums">
                {relativeTime(ageSeconds)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
