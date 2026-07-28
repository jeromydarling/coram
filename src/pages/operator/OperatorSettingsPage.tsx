/**
 * OperatorSettingsPage — Gardener personal settings & preferences.
 *
 * WHAT: Profile, password, timezone, theme, Gmail, and session management for Gardeners.
 * WHERE: /operator/settings
 * WHY: Gardeners need their own settings without tenant-specific billing, subscriptions, or team capacity cards.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Loader2, Save, Globe, Lock, Palette, AlertTriangle, Eye, EyeOff, LogOut, Moon, Sun, Monitor } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useTheme } from 'next-themes';
import { GoogleConnectCard } from '@/components/settings/GoogleConnectCard';
import { PushNotificationsCard } from '@/components/settings/PushNotificationsCard';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { LocalPulseKeywordTuner } from '@/components/events/LocalPulseKeywordTuner';
import { Search, Radio } from 'lucide-react';
import { useHomeMetroId } from '@/hooks/useHomeTerritory';
import { useMutation } from '@tanstack/react-query';

const TIMEZONES = [
  { group: 'Americas', zones: [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  ]},
  { group: 'Asia & Pacific', zones: [
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ]},
];

export default function OperatorSettingsPage() {
  const { user, profile, signOut } = useAuth();
  const { tenant } = useTenant();
  const homeMetroId = useHomeMetroId();

  const triggerPulse = useMutation({
    mutationFn: async () => {
      const metroId = homeMetroId.data;
      if (!metroId) throw new Error('No home territory set');
      const { error } = await supabase.functions.invoke('local-pulse-worker', {
        body: { metro_id: metroId, run_kind: 'manual', force: true, tenant_id: tenant?.id },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Local Pulse discovery started — results will appear shortly.'),
    onError: (e) => toast.error(e.message || 'Failed to trigger discovery'),
  });
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [timezone, setTimezone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setNickname((profile as any).nickname || '');
      setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const nameChanged = displayName !== (profile.display_name || '');
      const nickChanged = nickname !== ((profile as any).nickname || '');
      const tzChanged = timezone !== (profile.timezone || '');
      setHasChanges(nameChanged || nickChanged || tzChanged);
    }
  }, [displayName, nickname, timezone, profile]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName || null,
          nickname: nickname || null,
          timezone: timezone,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Settings saved');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOutAllSessions = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      toast.success('Signed out of all sessions');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign out');
    }
  };

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Gardener Settings</h1>
        <p className="text-sm text-muted-foreground mt-1"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Your personal preferences and connections — the tools that help you tend well.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear across the garden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="What should we call you?"
              />
              <p className="text-xs text-muted-foreground">
                Displayed in the header and console greetings
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || isChangingPassword}
            >
              {isChangingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Changing...</> : 'Change Password'}
            </Button>
          </CardContent>
        </Card>

        {/* Timezone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Timezone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Your Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TIMEZONES.map((group) => (
                    <div key={group.group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted sticky top-0">
                        {group.group}
                      </div>
                      {group.zones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Detected: {detectedTimezone}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTimezone(detectedTimezone)} disabled={timezone === detectedTimezone}>
              Use detected timezone
            </Button>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')} className="flex-1">
                <Sun className="mr-2 h-4 w-4" />Light
              </Button>
              <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')} className="flex-1">
                <Moon className="mr-2 h-4 w-4" />Dark
              </Button>
              <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')} className="flex-1">
                <Monitor className="mr-2 h-4 w-4" />System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Google Integration */}
        <GoogleConnectCard />
        <PushNotificationsCard />

        {/* Discovery Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Discovery Keywords
            </CardTitle>
            <CardDescription>
              Shape which local events and resources are discovered for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LocalPulseKeywordTuner overrideTenantId={tenant?.id} cardMode />
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Run Discovery Now</p>
                <p className="text-xs text-muted-foreground">Trigger a manual Local Pulse search using your keywords</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={triggerPulse.isPending || !homeMetroId.data}
                onClick={() => triggerPulse.mutate()}
              >
                {triggerPulse.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                {triggerPulse.isPending ? 'Running…' : 'Run Pulse'}
              </Button>
            </div>
            {!homeMetroId.data && (
              <p className="text-xs text-muted-foreground/70">Set a home territory first to enable discovery.</p>
            )}
          </CardContent>
        </Card>
        <PushNotificationsCard />

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
          </Button>
        </div>

        {/* Session Management */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Session Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sign Out All Sessions</Label>
                <p className="text-xs text-muted-foreground">Sign out of all devices and browsers</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm"><LogOut className="mr-2 h-4 w-4" />Sign Out All</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out of all sessions?</AlertDialogTitle>
                    <AlertDialogDescription>This will sign you out everywhere, including here.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSignOutAllSessions}>Sign Out All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
