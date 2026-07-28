import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Bell, ExternalLink, Loader2 } from 'lucide-react';

interface Notification {
  id: string;
  notification_type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  discovery_event: 'Event',
  discovery_grant: 'Grant',
  discovery_people: 'People',
  upcoming_event: 'Event',
  threshold_crossing: 'Threshold',
  leadership_change: 'Leadership',
  momentum_spike: 'Momentum',
  event_registration: 'Registration',
  communio_invite_received: 'Communio',
  communio_invite_accepted: 'Communio',
  communio_invite_declined: 'Communio',
  living_signal: 'Living',
  weekly_digest: 'Digest',
};

const typeColors: Record<string, string> = {
  discovery_event: 'bg-chart-1/20 text-chart-1',
  discovery_grant: 'bg-chart-2/20 text-chart-2',
  discovery_people: 'bg-chart-3/20 text-chart-3',
  upcoming_event: 'bg-chart-1/20 text-chart-1',
  threshold_crossing: 'bg-destructive/20 text-destructive',
  leadership_change: 'bg-chart-4/20 text-chart-4',
  momentum_spike: 'bg-primary/20 text-primary',
  event_registration: 'bg-chart-2/20 text-chart-2',
  communio_invite_received: 'bg-chart-3/20 text-chart-3',
  communio_invite_accepted: 'bg-chart-3/20 text-chart-3',
  communio_invite_declined: 'bg-muted text-muted-foreground',
  living_signal: 'bg-accent/20 text-accent-foreground',
  weekly_digest: 'bg-primary/10 text-primary',
};

export function NotificationFeed({ limit = 20 }: { limit?: number }) {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['proactive-notifications', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proactive_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as Notification[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notifications
          <HelpTooltip
            content="Notifications surface gently from events, signals, and community activity — never urgency-driven."
          />
          <Badge variant="secondary" className="ml-auto text-xs">
            {notifications.filter(n => !n.read).length} unread
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.map((n) => {
          const payload = n.payload as Record<string, string>;
          return (
            <div
              key={n.id}
              className={`flex items-start gap-2 text-sm p-2 rounded-md ${
                n.read ? 'opacity-60' : 'bg-muted/30'
              }`}
            >
              <Badge className={typeColors[n.notification_type] || 'bg-muted'} variant="secondary">
                {typeLabels[n.notification_type] || n.notification_type}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{payload.title || payload.why || 'Notification'}</p>
                {payload.why && payload.title && (
                  <p className="text-xs text-muted-foreground">{payload.why}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              {payload.url && (
                <a
                  href={payload.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
