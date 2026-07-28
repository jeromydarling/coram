/**
 * EmailProviders — Tenant admin email provider settings.
 *
 * WHAT: Shows connected email providers (Gmail / Outlook) with status and limits.
 * WHERE: /:tenantSlug/admin/email-providers
 * WHY: Allows tenant admins to manage email sending providers.
 */

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SendLimitIndicator } from '@/components/email/SendLimitIndicator';
import { Mail, Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { useState, useEffect, useCallback } from 'react';

export default function EmailProviders() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [connectingOutlook, setConnectingOutlook] = useState(false);

  // Gmail connection status
  const { data: gmailProfile } = useQuery({
    queryKey: ['gmail-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('gmail_email_address, gmail_sync_enabled')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Outlook connections
  const { data: outlookConnections, refetch: refetchOutlook } = useQuery({
    queryKey: ['outlook-connections', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('outlook_connections')
        .select('*')
        .eq('tenant_id', tenant!.id);
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Send limits for both providers
  const { data: sendLimits } = useQuery({
    queryKey: ['send-limits', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_send_limits')
        .select('*')
        .eq('tenant_id', tenant!.id);
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Listen for OAuth completion
  const handleOAuthMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'outlook-connected' && event.data?.success) {
      toast.success('Microsoft Outlook connected successfully');
      refetchOutlook();
      setConnectingOutlook(false);
    }
  }, [refetchOutlook]);

  useEffect(() => {
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [handleOAuthMessage]);

  const handleConnectOutlook = async () => {
    if (!tenant?.id) return;
    setConnectingOutlook(true);

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
        setConnectingOutlook(false);
        return;
      }

      // Open OAuth in popup
      const popup = window.open(data.auth_url, 'outlook-oauth', 'width=600,height=700');
      if (!popup) {
        toast.error('Popup blocked. Please allow popups and try again.');
        setConnectingOutlook(false);
      }
    } catch {
      toast.error('Failed to connect Outlook');
      setConnectingOutlook(false);
    }
  };

  const handleDisconnectOutlook = async (connectionId: string) => {
    const { error } = await supabase
      .from('outlook_connections')
      .delete()
      .eq('id', connectionId);
    
    if (error) {
      toast.error('Failed to disconnect');
    } else {
      toast.success('Outlook disconnected');
      refetchOutlook();
    }
  };

  const gmailLimit = sendLimits?.find(l => l.provider === 'gmail');
  const outlookLimit = sendLimits?.find(l => l.provider === 'outlook');

  return (
    <MainLayout title="Email Providers" subtitle="Manage connected email accounts for campaign sending.">
      <div className="max-w-3xl mx-auto space-y-6 p-6">

        {/* Gmail Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Gmail</CardTitle>
                  <CardDescription>Google Workspace sending</CardDescription>
                </div>
              </div>
              {gmailProfile?.gmail_email_address ? (
                <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {gmailProfile?.gmail_email_address && (
              <p className="text-sm text-muted-foreground">{gmailProfile.gmail_email_address}</p>
            )}
            {gmailLimit && (
              <SendLimitIndicator
                currentCount={gmailLimit.current_count}
                dailyLimit={gmailLimit.daily_limit}
                softThreshold={Math.floor(gmailLimit.daily_limit * (gmailLimit.soft_limit / 100))}
                hardThreshold={Math.floor(gmailLimit.daily_limit * (gmailLimit.hard_limit / 100))}
                provider="gmail"
              />
            )}
          </CardContent>
        </Card>

        {/* Outlook Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Microsoft Outlook</CardTitle>
                  <CardDescription>Microsoft 365 sending</CardDescription>
                </div>
              </div>
              {outlookConnections && outlookConnections.length > 0 ? (
                <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {outlookConnections?.map(conn => (
              <div key={conn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{conn.email_address}</p>
                  <p className="text-xs text-muted-foreground">
                    {conn.connection_status === 'connected' ? 'Active' : conn.connection_status}
                    {conn.tenant_domain && ` · ${conn.tenant_domain}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnectOutlook(conn.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}

            {outlookLimit && (
              <SendLimitIndicator
                currentCount={outlookLimit.current_count}
                dailyLimit={outlookLimit.daily_limit}
                softThreshold={Math.floor(outlookLimit.daily_limit * (outlookLimit.soft_limit / 100))}
                hardThreshold={Math.floor(outlookLimit.daily_limit * (outlookLimit.hard_limit / 100))}
                provider="outlook"
              />
            )}

            <Button
              onClick={handleConnectOutlook}
              disabled={connectingOutlook}
              variant="outline"
              className="w-full"
            >
              {connectingOutlook ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Connect Outlook Account
            </Button>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Microsoft 365 sending limits apply. Daily limit: 300 emails (conservative default).
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
