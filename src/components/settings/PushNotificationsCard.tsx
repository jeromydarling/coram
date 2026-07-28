import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, CheckCircle, XCircle, Loader2, Send } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { 
  useNotificationSettings, 
  useUpdateNotificationSettings, 
  usePushSubscriptionState 
} from '@/hooks/useNotificationSettings';
import { 
  initPushNotifications, 
  unregisterPushNotifications, 
  sendTestNotification,
  isPushSupported 
} from '@/lib/notifications';

export function PushNotificationsCard() {
  const { data: settings, isLoading: settingsLoading } = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const { permission, hasSubscription, isChecking, refresh, isSupported, isEnabled, isBlocked } = usePushSubscriptionState();
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleEnablePush = async () => {
    setIsEnabling(true);
    try {
      const result = await initPushNotifications();
      if (result.success) {
        toast.success('Push notifications enabled');
        await updateSettings.mutateAsync({ push_enabled: true });
        await refresh();
      } else {
        toast.error(result.error || 'Failed to enable notifications');
      }
    } catch (error) {
      toast.error('Failed to enable notifications');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDisablePush = async () => {
    setIsDisabling(true);
    try {
      const result = await unregisterPushNotifications();
      if (result.success) {
        toast.success('Push notifications disabled');
        await updateSettings.mutateAsync({ push_enabled: false });
        await refresh();
      } else {
        toast.error(result.error || 'Failed to disable notifications');
      }
    } catch (error) {
      toast.error('Failed to disable notifications');
    } finally {
      setIsDisabling(false);
    }
  };

  const handleToggleSetting = async (key: 'notify_ai_bundles' | 'notify_weekly_plan' | 'notify_events' | 'notify_post_event', value: boolean) => {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast.success('Setting updated');
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const result = await sendTestNotification();
      if (result.success) {
        toast.success('Test notification sent');
      } else {
        toast.error(result.error || 'Failed to send test');
      }
    } catch (error) {
      toast.error('Failed to send test');
    } finally {
      setIsSendingTest(false);
    }
  };

  const getStatusBadge = () => {
    if (!isSupported) {
      return <Badge variant="secondary">Not Supported</Badge>;
    }
    if (isBlocked) {
      return <Badge variant="destructive">Permission Blocked</Badge>;
    }
    if (isEnabled && settings?.push_enabled) {
      return <Badge variant="default" className="bg-success text-success-foreground">Enabled</Badge>;
    }
    return <Badge variant="secondary">Disabled</Badge>;
  };

  const getStatusIcon = () => {
    if (!isSupported || isBlocked) {
      return <XCircle className="w-5 h-5 text-muted-foreground" />;
    }
    if (isEnabled && settings?.push_enabled) {
      return <CheckCircle className="w-5 h-5 text-success" />;
    }
    return <BellOff className="w-5 h-5 text-muted-foreground" />;
  };

  const showMasterToggle = isSupported && !isBlocked;
  const showTriggerToggles = isEnabled && settings?.push_enabled;
  const isLoading = settingsLoading || isChecking;

  return (
    <Card data-tour="push-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive alerts for important updates on Android Chrome
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Row */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-tour="push-status">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="text-sm font-medium">Status</span>
          </div>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            getStatusBadge()
          )}
        </div>

        {/* Permission Blocked Warning */}
        {isBlocked && (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked. Please enable them in your browser settings.
          </p>
        )}

        {/* Not Supported Warning */}
        {!isSupported && (
          <p className="text-sm text-muted-foreground">
            Push notifications are not supported in this browser. Try using Chrome on Android.
          </p>
        )}

        {/* Master Toggle */}
        {showMasterToggle && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-master">Enable Push Notifications</Label>
              <p className="text-xs text-muted-foreground">
                {isEnabled ? 'Receive alerts for important updates' : 'Allow notifications from Profunda'}
              </p>
            </div>
            <Switch
              id="push-master"
              checked={isEnabled && settings?.push_enabled}
              disabled={isEnabling || isDisabling || isLoading}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleEnablePush();
                } else {
                  handleDisablePush();
                }
              }}
              data-tour="push-toggle"
            />
          </div>
        )}

        {/* Trigger Toggles */}
        {showTriggerToggles && (
          <>
            <Separator />
            <div className="space-y-4" data-tour="notification-types">
              <p className="text-sm font-medium">Notification Types</p>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-watchlist">Watchlist Signals</Label>
                  <p className="text-xs text-muted-foreground">Website change alerts for monitored orgs</p>
                </div>
                <Switch
                  id="notify-watchlist"
                  checked={settings?.notify_watchlist_signals ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_watchlist_signals' as any, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-campaign-sug">Campaign Suggestions</Label>
                  <p className="text-xs text-muted-foreground">New outreach ideas ready for review</p>
                </div>
                <Switch
                  id="notify-campaign-sug"
                  checked={settings?.notify_campaign_suggestions ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_campaign_suggestions' as any, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-enrichment">Event Enrichment</Label>
                  <p className="text-xs text-muted-foreground">Attendee matches found after events</p>
                </div>
                <Switch
                  id="notify-enrichment"
                  checked={settings?.notify_event_enrichment ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_event_enrichment' as any, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-meeting-notes">Meeting Notes</Label>
                  <p className="text-xs text-muted-foreground">Read.ai notes and action items ingested</p>
                </div>
                <Switch
                  id="notify-meeting-notes"
                  checked={settings?.notify_meeting_notes ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_meeting_notes' as any, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-overdue-tasks">Overdue Tasks</Label>
                  <p className="text-xs text-muted-foreground">Daily reminders for overdue and due-today tasks</p>
                </div>
                <Switch
                  id="notify-overdue-tasks"
                  checked={(settings as any)?.notify_overdue_tasks ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_overdue_tasks' as any, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-campaign-summary">Campaign Send Summary</Label>
                  <p className="text-xs text-muted-foreground">Delivery stats after campaign sends (opt-in)</p>
                </div>
                <Switch
                  id="notify-campaign-summary"
                  checked={settings?.notify_campaign_summary ?? false}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_campaign_summary' as any, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-automation">Automation Health</Label>
                  <p className="text-xs text-muted-foreground">Workflow failure alerts (admin/leadership)</p>
                </div>
                <Switch
                  id="notify-automation"
                  checked={settings?.notify_automation_health ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_automation_health' as any, checked)}
                />
              </div>

              <Separator className="my-2" />
              <p className="text-sm font-medium">Digests</p>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-daily-digest">Daily Digest</Label>
                  <p className="text-xs text-muted-foreground">Morning summary at 8:30am local</p>
                </div>
                <Switch
                  id="notify-daily-digest"
                  checked={settings?.notify_daily_digest ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_daily_digest' as any, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-weekly-summary">Weekly Summary</Label>
                  <p className="text-xs text-muted-foreground">Monday 9am recap (opt-in)</p>
                </div>
                <Switch
                  id="notify-weekly-summary"
                  checked={settings?.notify_weekly_summary ?? false}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_weekly_summary' as any, checked)}
                />
              </div>

              <Separator className="my-2" />
              <p className="text-sm font-medium">Legacy Triggers</p>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-ai-bundles">Follow-up Bundles</Label>
                  <p className="text-xs text-muted-foreground">When new follow-ups are found</p>
                </div>
                <Switch
                  id="notify-ai-bundles"
                  checked={settings?.notify_ai_bundles ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_ai_bundles', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-weekly-plan">Weekly Focus Plan</Label>
                  <p className="text-xs text-muted-foreground">When your weekly plan is ready</p>
                </div>
                <Switch
                  id="notify-weekly-plan"
                  checked={settings?.notify_weekly_plan ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_weekly_plan', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-events">Event Week Reminders</Label>
                  <p className="text-xs text-muted-foreground">Before conferences you're attending</p>
                </div>
                <Switch
                  id="notify-events"
                  checked={settings?.notify_events ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_events', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-post-event">Post-Event Follow-ups</Label>
                  <p className="text-xs text-muted-foreground">After events when follow-ups are ready</p>
                </div>
                <Switch
                  id="notify-post-event"
                  checked={settings?.notify_post_event ?? true}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => handleToggleSetting('notify_post_event', checked)}
                />
              </div>
            </div>

            {/* Dev-only test button */}
            {import.meta.env.DEV && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                  className="w-full"
                >
                  {isSendingTest ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Test Notification
                </Button>
              </>
            )}
          </>
        )}

      </CardContent>
    </Card>
  );
}
