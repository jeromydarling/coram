/**
 * OutlookConnectCard — Microsoft Outlook/365 connection card.
 *
 * WHAT: Card for connecting Microsoft Outlook (email sending + calendar) via OAuth.
 * WHERE: /settings (Integrations tab) — tenant-facing only.
 * WHY: Mirrors the Google Connect experience for organizations using Microsoft 365.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, AlertTriangle, ExternalLink, Mail, Trash2 } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';

export function OutlookConnectCard() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Outlook connections for this tenant
  const { data: connections, isLoading, refetch } = useQuery({
    queryKey: ['outlook-connections', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('outlook_connections')
        .select('id, email_address, connection_status, last_sync_at, scopes')
        .eq('tenant_id', tenant!.id);
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Send limits
  const { data: sendLimits } = useQuery({
    queryKey: ['outlook-send-limits', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_send_limits')
        .select('daily_limit, current_count, email_address')
        .eq('tenant_id', tenant!.id)
        .eq('provider', 'outlook');
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  const isConnected = (connections?.length ?? 0) > 0;
  const activeConnection = connections?.[0];

  // Listen for OAuth popup completion
  const handleOAuthMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'outlook-connected' && event.data?.success) {
      toast.success('Microsoft Outlook connected successfully');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['outlook-send-limits'] });
      setIsConnecting(false);
    }
  }, [refetch, queryClient]);

  useEffect(() => {
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [handleOAuthMessage]);

  const handleConnect = async () => {
    if (!tenant?.id) return;
    setIsConnecting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUri = `${supabaseUrl}/functions/v1/outlook-callback`;

      const { data, error } = await supabase.functions.invoke('outlook-connect', {
        body: {
          tenant_id: tenant.id,
          redirect_uri: redirectUri,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Failed to initiate Outlook connection');
        setIsConnecting(false);
        return;
      }

      const popup = window.open(data.auth_url, 'outlook-oauth', 'width=600,height=700');
      if (!popup) {
        toast.error('Popup blocked. Please allow popups and try again.');
        setIsConnecting(false);
      }
    } catch {
      toast.error('Failed to connect Outlook');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    const { error } = await supabase
      .from('outlook_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      toast.error('Failed to disconnect');
    } else {
      toast.success('Outlook disconnected');
      refetch();
    }
  };

  const limitInfo = sendLimits?.find(
    l => l.email_address === activeConnection?.email_address
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M21.17 2.06A1.63 1.63 0 0 0 19.63 2H4.37A1.63 1.63 0 0 0 2.83 2.06 1.55 1.55 0 0 0 2 3.5v17A1.55 1.55 0 0 0 2.83 21.94 1.63 1.63 0 0 0 4.37 22h15.26a1.63 1.63 0 0 0 1.54-.06A1.55 1.55 0 0 0 22 20.5v-17A1.55 1.55 0 0 0 21.17 2.06z" fill="#0078D4"/>
                <path d="M14 7.5v9L8 19V5l6 2.5z" fill="#fff" opacity="0.9"/>
                <path d="M14 7.5L20 5v14l-6-2.5v-9z" fill="#fff" opacity="0.6"/>
              </svg>
              Connect Outlook
            </CardTitle>
            <CardDescription>
              Microsoft 365 email sending for campaigns
            </CardDescription>
          </div>
          <HelpTooltip
            what="Connect your Microsoft 365 account to send campaigns via Outlook."
            where="Settings — Integrations"
            why="Organizations using Microsoft 365 can send relationship-based campaigns directly from their Outlook account."
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection…
          </div>
        ) : isConnected && activeConnection ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="flex flex-col gap-1">
                <span className="font-medium">Outlook connected</span>
                <span className="text-xs text-muted-foreground">{activeConnection.email_address}</span>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Not connected. Connect your Microsoft 365 account to send campaigns via Outlook.
            </AlertDescription>
          </Alert>
        )}

        {/* Connect / Reconnect / Disconnect */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            variant={isConnected ? 'outline' : 'default'}
            size={isConnected ? 'sm' : 'default'}
          >
            {isConnecting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
            ) : isConnected ? (
              <><ExternalLink className="mr-2 h-4 w-4" />Reconnect Outlook</>
            ) : (
              <>Connect Outlook</>
            )}
          </Button>
          {isConnected && activeConnection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDisconnect(activeConnection.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Feature status (only when connected) */}
        {isConnected && activeConnection && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What's enabled</p>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Outlook Campaigns
                  </Label>
                  <Badge variant="default" className="text-xs">Active</Badge>
                </div>
              </div>

              {limitInfo && (
                <p className="text-xs text-muted-foreground">
                  Daily limit: {limitInfo.current_count}/{limitInfo.daily_limit} emails sent today
                </p>
              )}

              {activeConnection.last_sync_at && (
                <p className="text-xs text-muted-foreground">
                  Connected {format(new Date(activeConnection.last_sync_at), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </>
        )}

        {!isConnected && (
          <p className="text-xs text-muted-foreground">
            Connect your Microsoft 365 account to send campaigns via Outlook. A daily send limit of 300 messages protects your sender reputation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
