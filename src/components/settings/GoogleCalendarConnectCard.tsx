/**
 * GoogleCalendarConnectCard — Connect Google Calendar from Gardener Settings.
 *
 * WHAT: Shows calendar connection status and provides connect/reconnect button.
 * WHERE: /operator/settings (Gardener Settings page)
 * WHY: Gardeners need to connect their Google Calendar for scheduling sync
 *      without navigating away from the operator console.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '@/components/ui/sonner';

export function GoogleCalendarConnectCard() {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: calendarStatus, isLoading } = useQuery({
    queryKey: ['google-calendar-status', user?.id],
    queryFn: async () => {
      if (!user) return { isConnected: false, email: null };
      const { data } = await supabase
        .from('profiles')
        .select('google_calendar_enabled, gmail_email_address')
        .eq('user_id', user.id)
        .single();
      return {
        isConnected: !!data?.google_calendar_enabled,
        email: data?.gmail_email_address || null,
      };
    },
    enabled: !!user,
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=auth-url`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        toast.error(result.error || 'Failed to get auth URL');
      }
    } catch (error) {
      console.error('Connect error:', error);
      toast.error('Failed to start connection');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar
            </CardTitle>
            <CardDescription>
              Sync your calendar for scheduling and meeting tracking
            </CardDescription>
          </div>
          <HelpTooltip
            what="Connect your Google Calendar to sync events and meetings."
            where="Gardener Settings — Integrations"
            why="Calendar sync enables meeting tracking, post-meeting reflections, and scheduling awareness across the platform."
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection…
          </div>
        ) : calendarStatus?.isConnected ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center gap-2">
              <span>Connected</span>
              {calendarStatus.email && <Badge variant="secondary">{calendarStatus.email}</Badge>}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Google Calendar not connected. Connect to enable scheduling sync and meeting awareness.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {calendarStatus?.isConnected
              ? 'Your calendar events are syncing. Reconnect to update permissions or switch accounts.'
              : 'Connecting grants read access to your calendar events and the ability to create new ones for scheduling.'}
          </p>

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            variant={calendarStatus?.isConnected ? 'outline' : 'default'}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : calendarStatus?.isConnected ? (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Reconnect Calendar
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Connect Google Calendar
              </>
            )}
          </Button>
        </div>

        {!calendarStatus?.isConnected && (
          <p className="text-xs text-muted-foreground">
            This also connects Gmail for campaigns and email sync. One connection covers both.
          </p>
        )}
      </CardContent>
    </Card>
  );
}