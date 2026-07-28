import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Sparkles, Calendar, AlertCircle } from 'lucide-react';
import { useAIUserSettings, useEnableGmailAI } from '@/hooks/useAIUserSettings';
import { format } from 'date-fns';

export function GmailAISettingsCard() {
  const { data: settings, isLoading } = useAIUserSettings();
  const { mutate: enableGmailAI, isPending: isEnabling } = useEnableGmailAI();

  const isGmailConnected = !!settings?.gmail_connected_at;
  const isAIEnabled = !!settings?.gmail_ai_enabled;
  const enabledAt = settings?.gmail_ai_enabled_at;

  const handleToggleAI = async () => {
    if (!isAIEnabled) {
      enableGmailAI();
    }
    // Note: Disabling is not supported - forward-only analysis
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Gmail Email Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Gmail Email Analysis
        </CardTitle>
        <CardDescription>
          Analyze your Gmail emails to suggest contacts, tasks, and follow-ups
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gmail Connection Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Gmail Connection
            </Label>
            <p className="text-xs text-muted-foreground">
              {isGmailConnected 
                ? `Connected on ${format(new Date(settings.gmail_connected_at!), 'MMM d, yyyy')}`
                : 'Connect via Google Calendar Sync first'}
            </p>
          </div>
          <Badge variant={isGmailConnected ? 'default' : 'secondary'}>
            {isGmailConnected ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>

        <Separator />

        {/* Analysis Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="gmailAI" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Email Analysis
            </Label>
            <p className="text-xs text-muted-foreground">
              {isAIEnabled 
                ? 'New emails will be analyzed for actionable insights'
                : 'Enable to start analyzing emails for contacts and tasks'}
            </p>
          </div>
          {isGmailConnected ? (
            <Switch
              id="gmailAI"
              checked={isAIEnabled}
              onCheckedChange={handleToggleAI}
              disabled={isEnabling || isAIEnabled} // Can't disable once enabled
            />
          ) : (
            <Button variant="outline" size="sm" disabled>
              Connect Gmail First
            </Button>
          )}
        </div>

        {/* Forward-only notice */}
        {isAIEnabled && enabledAt && (
          <>
            <Separator />
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Forward-only Analysis</p>
                <p className="text-xs text-muted-foreground">
                  Only emails received after {format(new Date(enabledAt), "MMM d, yyyy 'at' h:mm a")} will be analyzed.
                  Past emails are never processed for your privacy.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Not connected warning */}
        {!isGmailConnected && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Gmail Not Connected</p>
              <p className="text-xs text-muted-foreground">
                To use Email Analysis, first connect your Google account via Calendar Sync.
                Go to Calendar page and click "Connect Google Calendar".
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
