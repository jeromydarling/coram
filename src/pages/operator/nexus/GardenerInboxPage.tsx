/**
 * GardenerInboxPage — Calm inbox for routed tickets.
 *
 * WHAT: Shows tickets assigned to the current gardener with metadata-only display.
 * WHERE: /operator/nexus/inbox (CURA zone — daily workflow)
 * WHY: Each gardener needs a focused view of their assigned work without seeing tenant PII.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Inbox, CheckCircle2, Clock, AlertTriangle, Eye, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { useGardeners } from '@/hooks/useGardenerTeam';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-muted text-muted-foreground',
  notice: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export default function GardenerInboxPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('mine');
  const { data: gardeners } = useGardeners();

  const currentGardener = (gardeners ?? []).find((g: any) => g.id === user?.id);

  // Fetch recovery tickets routed to me
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['gardener-inbox-tickets', user?.id, tab],
    enabled: !!user?.id,
    queryFn: async () => {
      // Recovery tickets where I'm in the routed_to array
      const { data, error } = await supabase
        .from('recovery_tickets')
        .select('id, tenant_id, type, status, suspected_entity_type, current_route, routing_reason, routed_at, created_at, updated_at, tenants:tenant_id(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      // Filter by routing
      return (data ?? []).filter((t: any) => {
        if (tab === 'mine') {
          return t.routed_to_gardener_ids?.includes(user!.id);
        }
        return true; // 'all' tab
      });
    },
  });

  // Fetch operator notifications routed to me
  const { data: notifications, isLoading: notifsLoading } = useQuery({
    queryKey: ['gardener-inbox-notifs', user?.id, tab],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from('operator_notifications')
        .select('id, type, severity, title, body, deep_link, is_read, routing_reason, routed_gardener_id, created_at, tenant_id, tenants:tenant_id(name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (tab === 'mine') {
        query = query.eq('routed_gardener_id', user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gardener-inbox-notifs'] });
      qc.invalidateQueries({ queryKey: ['operator-unread-count'] });
    },
  });

  const isLoading = ticketsLoading || notifsLoading;

  // Combine and sort by created_at
  const items = [
    ...(notifications ?? []).map((n: any) => ({ ...n, _kind: 'notification' as const })),
    ...(tickets ?? []).map((t: any) => ({ ...t, _kind: 'ticket' as const, severity: 'medium' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Inbox className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">Garden Inbox</h1>
          <HelpTip text="Your personal triage space. Tickets are routed here by metro, archetype, or assignment. Record names are hidden for privacy." />
        </div>
        <p className="text-sm text-muted-foreground">
          {currentGardener
            ? `Tending as ${currentGardener.display_name}. Only safe metadata is shown.`
            : 'You are not yet registered as a gardener. Ask the Master Gardener to add you.'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">Assigned to Me</TabsTrigger>
          <TabsTrigger value="all">All Tickets</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      )}

      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            Nothing needs your attention right now. The garden is peaceful.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.map((item: any) => {
          const tenantName = (item as any).tenants?.name ?? 'Unknown tenant';
          const severity = item.severity ?? 'info';
          const isNotif = item._kind === 'notification';

          return (
            <Card key={item.id} className={`transition-opacity ${isNotif && item.is_read ? 'opacity-60' : ''}`}>
              <CardContent className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-[10px] ${SEVERITY_COLORS[severity] ?? ''}`}>
                      {severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {isNotif ? item.type : item.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{tenantName}</span>
                  </div>
                  <p className="text-sm font-medium truncate">
                    {isNotif ? item.title : `${(item.suspected_entity_type ?? 'Record')} — ${item.type} ticket`}
                  </p>
                  {item.routing_reason && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Routed: {item.routing_reason.replace(/_/g, ' ')}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()} · {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {isNotif && !item.is_read && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => markRead.mutate(item.id)}>
                      <Eye className="h-3 w-3" /> Read
                    </Button>
                  )}
                  {item.deep_link && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                      <a href={item.deep_link}><ArrowRight className="h-3 w-3" /></a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
