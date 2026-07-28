/**
 * GoogleConnectCard — Unified Google connection card.
 *
 * WHAT: Single card for connecting Google (Calendar + Gmail + Email Analysis) via one OAuth flow.
 * WHERE: /operator/settings and /settings (Integrations tab)
 * WHY: One OAuth flow grants all Google permissions — Calendar sync, Gmail campaigns, and email analysis.
 *      Showing three separate cards was confusing and redundant.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, AlertTriangle, ExternalLink, Sparkles, Calendar, Mail } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnectionStatus } from '@/hooks/useGmailCampaignSend';
import { useAIUserSettings, useEnableGmailAI } from '@/hooks/useAIUserSettings';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';

export function GoogleConnectCard() {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  // Calendar status from profiles
  const { data: calendarStatus, isLoading: calLoading } = useQuery({
    queryKey: ['google-calendar-status', user?.id],
    queryFn: async () => {
      if (!user) return { isConnected: false };
      const { data } = await supabase
        .from('profiles')
        .select('google_calendar_enabled')
        .eq('user_id', user.id)
        .single();
      return { isConnected: !!data?.google_calendar_enabled };
    },
    enabled: !!user,
  });

  // Gmail campaign sender status
  const { data: gmailStatus, isLoading: gmailLoading } = useGmailConnectionStatus();

  // AI analysis settings
  const { data: aiSettings, isLoading: aiLoading } = useAIUserSettings();
  const { mutate: enableGmailAI, isPending: isEnabling } = useEnableGmailAI();

  const isLoading = calLoading || gmailLoading || aiLoading;
  const isConnected = !!calendarStatus?.isConnected || !!gmailStatus?.isConnected;
  const senderEmail = gmailStatus?.senderEmail || null;
  const isAIEnabled = !!aiSettings?.gmail_ai_enabled;
  const aiEnabledAt = aiSettings?.gmail_ai_enabled_at;

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

  const handleToggleAI = () => {
    if (!isAIEnabled) {
      enableGmailAI();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect Google
            </CardTitle>
            <CardDescription>
              Calendar sync, Gmail campaigns, and email analysis — one connection
            </CardDescription>
          </div>
          <HelpTooltip
            what="Connect your Google account to enable Calendar sync, Gmail campaign sending, and email analysis."
            where="Settings — Integrations"
            why="A single Google connection powers scheduling awareness, email outreach, and NRI email insights across the platform."
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection…
          </div>
        ) : isConnected ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="flex flex-col gap-1">
                <span className="font-medium">Google account connected</span>
                {senderEmail && (
                  <span className="text-xs text-muted-foreground">{senderEmail}</span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Not connected. Connect your Google account to enable calendar sync, email campaigns, and email analysis.
            </AlertDescription>
          </Alert>
        )}

        {/* Connection / Reconnect */}
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          variant={isConnected ? 'outline' : 'default'}
          size={isConnected ? 'sm' : 'default'}
        >
          {isConnecting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
          ) : isConnected ? (
            <><ExternalLink className="mr-2 h-4 w-4" />Reconnect Google</>
          ) : (
            <>Connect Google</>
          )}
        </Button>

        {/* Feature status badges (only when connected) */}
        {isConnected && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What's enabled</p>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Calendar Sync
                  </Label>
                  <Badge variant="default" className="text-xs">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Gmail Campaigns
                  </Label>
                  {senderEmail ? (
                    <Badge variant="default" className="text-xs">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Reconnect needed</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailAnalysis" className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    Email Analysis
                  </Label>
                  <Switch
                    id="emailAnalysis"
                    checked={isAIEnabled}
                    onCheckedChange={handleToggleAI}
                    disabled={isEnabling || isAIEnabled}
                  />
                </div>
              </div>

              {isAIEnabled && aiEnabledAt && (
                <p className="text-xs text-muted-foreground pl-6">
                  Analyzing emails received after {format(new Date(aiEnabledAt), "MMM d, yyyy")}. Past emails are never processed.
                </p>
              )}
            </div>
          </>
        )}

        {!isConnected && (
          <p className="text-xs text-muted-foreground">
            One connection grants calendar read/write, email sending for campaigns, and email analysis for contact suggestions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}