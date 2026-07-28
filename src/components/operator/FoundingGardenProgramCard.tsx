/**
 * FoundingGardenProgramCard — Gardener Nexus visibility card for Founding Garden status.
 *
 * WHAT: Shows program cap, purchased count, remaining, and recent audit events.
 * WHERE: Gardener Nexus (CRESCERE zone — revenue & growth).
 * WHY: Operator observability into the founding program without touching tenant data.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Sprout, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface FGEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  created_at: string;
  stripe_session_id: string | null;
}

export function FoundingGardenProgramCard() {
  const { data: status } = useQuery({
    queryKey: ['founding-garden-status-operator'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('founding-garden-status');
      if (error) throw error;
      return data as { ok: boolean; is_active: boolean; cap: number; purchased_count: number; remaining: number; is_available: boolean };
    },
    staleTime: 30_000,
  });

  const { data: events } = useQuery({
    queryKey: ['founding-garden-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('founding_garden_events' as any)
        .select('id, tenant_id, event_type, created_at, stripe_session_id')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as FGEvent[];
    },
    staleTime: 30_000,
  });

  const eventIcon = (type: string) => {
    if (type === 'status_granted') return <CheckCircle className="h-3 w-3 text-primary" />;
    if (type === 'status_denied' || type === 'cap_reached') return <XCircle className="h-3 w-3 text-destructive" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sprout className="h-4 w-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
            Founding Garden Program
          </h3>
        </div>

        {status && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{status.purchased_count}</p>
              <p className="text-[10px] text-muted-foreground">purchased</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{status.remaining}</p>
              <p className="text-[10px] text-muted-foreground">remaining</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">
                {status.is_active ? (
                  <span className="text-primary">Active</span>
                ) : (
                  <span className="text-muted-foreground">Closed</span>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">status</p>
            </div>
          </div>
        )}

        {events && events.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">Recent events</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[11px]">
                  {eventIcon(e.event_type)}
                  <span className="text-muted-foreground flex-1 truncate">{e.event_type.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground/60">{format(new Date(e.created_at), 'MMM d, h:mm a')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
