/**
 * Settings — Tenant user settings page, organized by tabs.
 *
 * WHAT: Profile, security, appearance, integrations, modules, notifications, and account management.
 * WHERE: /:tenantSlug/settings
 * WHY: The settings page grew too large as cards — tabs reduce scrolling and improve discoverability.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Loader2, Save, Globe, Lock, Bell, Palette, AlertTriangle, Eye, EyeOff, LogOut, Moon, Sun, Monitor, User, Plug, LayoutGrid, CreditCard, Banknote, Building2 } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useTheme } from 'next-themes';
import { GoogleConnectCard } from '@/components/settings/GoogleConnectCard';
import { OutlookConnectCard } from '@/components/settings/OutlookConnectCard';
import { IgnoredDomainsCard } from '@/components/settings/IgnoredDomainsCard';
import { ReadAISettingsCard } from '@/components/settings/ReadAISettingsCard';
import { PushNotificationsCard } from '@/components/settings/PushNotificationsCard';

import { HubSpotSettingsCard } from '@/components/settings/HubSpotSettingsCard';
import { SubscriptionSettingsCard } from '@/components/settings/SubscriptionSettingsCard';
import { AIUsageCard } from '@/components/settings/AIUsageCard';
import { DeepInsightBanner } from '@/components/ai/DeepInsightBanner';
import { AddOnManagementCard } from '@/components/settings/AddOnManagementCard';
import { TeamCapacitySection } from '@/components/settings/TeamCapacitySection';
import { TrustExportCard } from '@/components/settings/TrustExportCard';
import { SimpleIntakeCard } from '@/components/settings/SimpleIntakeCard';
import { CommunioAwarenessToggle } from '@/components/settings/CommunioAwarenessToggle';
import { NarrativeCompanionSettings } from '@/components/settings/NarrativeCompanionSettings';
import { CompanionModeSettingsCard } from '@/components/settings/CompanionModeSettingsCard';
import { MissionIdentityCard } from '@/components/settings/MissionIdentityCard';
import { DiscoveryKeywordPanel } from '@/components/settings/DiscoveryKeywordPanel';
import { FamiliaSettingsCard } from '@/components/settings/FamiliaSettingsCard';
import { ProvisionModeCard } from '@/components/settings/ProvisionModeCard';
import { ImpactDimensionsCard } from '@/components/settings/ImpactDimensionsCard';
import { FamiliaSharingToggle } from '@/components/settings/FamiliaSharingToggle';
import DigestPreferencesCard from '@/components/settings/DigestPreferencesCard';
import { RecoveryBreadcrumbsCard } from '@/components/settings/RecoveryBreadcrumbsCard';
import { RelationalFocusCard } from '@/components/settings/RelationalFocusCard';
import { PersonalityStrengthsPanel } from '@/components/indoles/PersonalityStrengthsPanel';
import { StripeConnectCard } from '@/components/settings/StripeConnectCard';
import { useTenant } from '@/contexts/TenantContext';
import { PaymentsToolkit } from '@/components/payments/PaymentsToolkit';
import { OrganizationsTab } from '@/components/settings/OrganizationsTab';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { handleMutationError } from '@/lib/permissionErrors';


function LeaveOrganizationSection() {
  const { t } = useTranslation('settings');
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No organization found');
      const { data, error } = await supabase.rpc('leave_tenant', { p_tenant_id: tenant.id });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) throw new Error(result?.message || 'Cannot leave organization');
      return result;
    },
    onSuccess: () => {
      toast.success(t('dangerZone.leftOrg'));
      navigate('/login', { replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!tenant) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{t('dangerZone.leaveOrg')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('dangerZone.leaveOrgDescription', { org: tenant.name || 'this organization' })}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            {t('dangerZone.leave')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dangerZone.leaveOrgConfirmTitle', { org: tenant.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dangerZone.leaveOrgConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('familia.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaveMutation.isPending ? t('dangerZone.leaving') : t('dangerZone.leaveOrganization')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Common timezones grouped by region
const TIMEZONES = [
  { group: 'Americas', zones: [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'America/Phoenix', label: 'Arizona (no DST)' },
    { value: 'America/Toronto', label: 'Toronto' },
    { value: 'America/Vancouver', label: 'Vancouver' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Berlin', label: 'Central European (CET)' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Europe/Madrid', label: 'Madrid' },
    { value: 'Europe/Rome', label: 'Rome' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam' },
    { value: 'Europe/Athens', label: 'Athens' },
    { value: 'Europe/Moscow', label: 'Moscow' },
  ]},
  { group: 'Asia/Pacific', zones: [
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok' },
    { value: 'Asia/Singapore', label: 'Singapore' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Seoul', label: 'Seoul' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland' },
  ]},
  { group: 'Africa', zones: [
    { value: 'Africa/Cairo', label: 'Cairo' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg' },
    { value: 'Africa/Lagos', label: 'Lagos' },
    { value: 'Africa/Nairobi', label: 'Nairobi' },
  ]},
];

export default function Settings() {
  const { t } = useTranslation('settings');
  const { user, profile, signOut, isSteward } = useAuth();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [timezone, setTimezone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification preferences (stored locally for now)
  const [emailReports, setEmailReports] = useState(() => {
    const saved = localStorage.getItem('notify_emailReports');
    return saved !== null ? saved === 'true' : true;
  });
  const [emailAlerts, setEmailAlerts] = useState(() => {
    const saved = localStorage.getItem('notify_emailAlerts');
    return saved !== null ? saved === 'true' : true;
  });
  const [emailActivity, setEmailActivity] = useState(() => {
    const saved = localStorage.getItem('notify_emailActivity');
    return saved !== null ? saved === 'true' : false;
  });

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setNickname((profile as any).nickname || '');
      setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [profile]);

  // Track changes
  useEffect(() => {
    if (profile) {
      const nameChanged = displayName !== (profile.display_name || '');
      const nickChanged = nickname !== ((profile as any).nickname || '');
      const tzChanged = timezone !== (profile.timezone || '');
      setHasChanges(nameChanged || nickChanged || tzChanged);
    }
  }, [displayName, nickname, timezone, profile]);

  // Save notification preferences to localStorage
  useEffect(() => {
    localStorage.setItem('notify_emailReports', String(emailReports));
    localStorage.setItem('notify_emailAlerts', String(emailAlerts));
    localStorage.setItem('notify_emailActivity', String(emailActivity));
  }, [emailReports, emailAlerts, emailActivity]);

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

      toast.success(t('save.saved'));
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      handleMutationError(error, t('save.failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error(t('password.fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('password.passwordsMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t('password.minLength'));
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success(t('password.changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
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
      console.error('Error signing out:', error);
      toast.error(error.message || 'Failed to sign out of all sessions');
    }
  };

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <MainLayout title={t('title')} subtitle={t('subtitle')} helpKey="page.settings" data-testid="settings-root">
      <div className="max-w-2xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
            <TabsTrigger value="profile" className="gap-1.5 data-[state=active]:bg-muted">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('tabs.profile')}</span>
            </TabsTrigger>
            {isSteward && (
              <TabsTrigger value="integrations" className="gap-1.5 data-[state=active]:bg-muted">
                <Plug className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('tabs.integrations')}</span>
              </TabsTrigger>
            )}
            {isSteward && (
              <TabsTrigger value="modules" className="gap-1.5 data-[state=active]:bg-muted">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('tabs.modules')}</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications" className="gap-1.5 data-[state=active]:bg-muted">
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('tabs.notifications')}</span>
            </TabsTrigger>
            {isSteward && (
              <TabsTrigger value="billing" className="gap-1.5 data-[state=active]:bg-muted">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('tabs.billing')}</span>
              </TabsTrigger>
            )}
            {isSteward && (
              <TabsTrigger value="payments" className="gap-1.5 data-[state=active]:bg-muted">
                <Banknote className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Payments</span>
              </TabsTrigger>
            )}
            {isSteward && (
              <TabsTrigger value="organizations" className="gap-1.5 data-[state=active]:bg-muted">
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Organizations</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="account" className="gap-1.5 data-[state=active]:bg-muted">
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('tabs.account')}</span>
            </TabsTrigger>
          </TabsList>
          {!isSteward && (
            <p className="text-xs text-muted-foreground -mt-3">
              Some organization settings are managed by your steward.
            </p>
          )}

          {/* ─── PROFILE TAB ─── */}
          <TabsContent value="profile" className="space-y-6">
            {/* Profile */}
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.title')}</CardTitle>
                <CardDescription>{t('profile.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('profile.email')}</Label>
                  <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">{t('profile.emailCannotChange')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t('profile.fullName')}</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('profile.fullNamePlaceholder')} />
                  <p className="text-xs text-muted-foreground">{t('profile.fullNameHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">{t('profile.nickname')}</Label>
                  <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('profile.nicknamePlaceholder')} />
                  <p className="text-xs text-muted-foreground">{t('profile.nicknameHint')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Timezone */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('timezone.title')}
                </CardTitle>
                <CardDescription>{t('timezone.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">{t('timezone.label')}</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder={t('timezone.placeholder')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {TIMEZONES.map((group) => (
                        <div key={group.group}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted sticky top-0">{group.group}</div>
                          {group.zones.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('timezone.detected', { tz: detectedTimezone })}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTimezone(detectedTimezone)} disabled={timezone === detectedTimezone}>
                  {t('timezone.useDetected')}
                </Button>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  {t('appearance.title')}
                </CardTitle>
                <CardDescription>{t('appearance.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('preferences.theme')}</Label>
                  <div className="flex gap-2">
                    <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')} className="flex-1">
                      <Sun className="mr-2 h-4 w-4" /> {t('preferences.themeLight')}
                    </Button>
                    <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')} className="flex-1">
                      <Moon className="mr-2 h-4 w-4" /> {t('preferences.themeDark')}
                    </Button>
                    <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')} className="flex-1">
                      <Monitor className="mr-2 h-4 w-4" /> {t('preferences.themeSystem')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('preferences.themeHint')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Personality & Strengths */}
            {user?.id && (
              <PersonalityStrengthsPanel
                entityType="profile"
                entityId={user.id}
                showBio
                showVisibility
              />
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('save.saving')}</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> {t('save.saveChanges')}</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* ─── INTEGRATIONS TAB (steward only) ─── */}
          {isSteward && (
            <TabsContent value="integrations" className="space-y-6">
              <GoogleConnectCard />
              <OutlookConnectCard />
              <ReadAISettingsCard />
              <IgnoredDomainsCard />
              <SimpleIntakeCard />
              <NarrativeCompanionSettings />
              <HubSpotSettingsCard />
            </TabsContent>
          )}

          {/* ─── MODULES TAB (steward only) ─── */}
          {isSteward && (
            <TabsContent value="modules" className="space-y-6">
              <MissionIdentityCard />
              <CompanionModeSettingsCard />
              <RelationalFocusCard />
              <CommunioAwarenessToggle />
              <FamiliaSettingsCard />
              <FamiliaSharingToggle />
              <ProvisionModeCard />
              <ImpactDimensionsCard />
              <DigestPreferencesCard />
              <DiscoveryKeywordPanel />
              <RecoveryBreadcrumbsCard />
            </TabsContent>
          )}

          {/* ─── NOTIFICATIONS TAB ─── */}
          <TabsContent value="notifications" className="space-y-6">
            <PushNotificationsCard />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t('emailNotifications.title')}
                </CardTitle>
                <CardDescription>{t('emailNotifications.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailReports">{t('emailNotifications.scheduledReports')}</Label>
                    <p className="text-xs text-muted-foreground">{t('emailNotifications.scheduledReportsDesc')}</p>
                  </div>
                  <Switch id="emailReports" checked={emailReports} onCheckedChange={setEmailReports} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailAlerts">{t('emailNotifications.actionAlerts')}</Label>
                    <p className="text-xs text-muted-foreground">{t('emailNotifications.actionAlertsDesc')}</p>
                  </div>
                  <Switch id="emailAlerts" checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailActivity">{t('emailNotifications.activityUpdates')}</Label>
                    <p className="text-xs text-muted-foreground">{t('emailNotifications.activityUpdatesDesc')}</p>
                  </div>
                  <Switch id="emailActivity" checked={emailActivity} onCheckedChange={setEmailActivity} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── BILLING TAB (steward only) ─── */}
          {isSteward && (
            <TabsContent value="billing" className="space-y-6">
              <SubscriptionSettingsCard />
              <AddOnManagementCard />
              <TeamCapacitySection />
              <DeepInsightBanner />
              <AIUsageCard />
              <TrustExportCard />
            </TabsContent>
          )}

          {/* ─── PAYMENTS TAB (steward only) ─── */}
          {isSteward && (
            <TabsContent value="payments" className="space-y-6">
              <StripeConnectCard />
              <PaymentsToolkit />
            </TabsContent>
          )}

          {/* ─── ORGANIZATIONS TAB (steward only) ─── */}
          {isSteward && (
            <TabsContent value="organizations" className="space-y-6">
              <OrganizationsTab />
            </TabsContent>
          )}

          {/* ─── ACCOUNT TAB ─── */}
          <TabsContent value="account" className="space-y-6">
            {/* Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('password.title')}
                </CardTitle>
                <CardDescription>{t('password.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('password.newPassword')}</Label>
                  <div className="relative">
                    <Input id="newPassword" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('password.newPasswordPlaceholder')} className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <PasswordStrengthIndicator password={newPassword} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('password.confirmPassword')}</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('password.confirmPasswordPlaceholder')} className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">{t('password.passwordsMismatch')}</p>
                  )}
                </div>
                <Button onClick={handlePasswordChange} disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || isChangingPassword}>
                  {isChangingPassword ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('password.changing')}</>) : t('password.changePassword')}
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {t('dangerZone.title')}
                </CardTitle>
                <CardDescription>{t('dangerZone.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('dangerZone.signOutAll')}</Label>
                    <p className="text-xs text-muted-foreground">{t('dangerZone.signOutAllDescription')}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm"><LogOut className="mr-2 h-4 w-4" /> {t('dangerZone.signOutAllButton')}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('dangerZone.signOutAllConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('dangerZone.signOutAllConfirmDescription')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('familia.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSignOutAllSessions}>{t('dangerZone.signOutAllButton')}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <Separator />
                <LeaveOrganizationSection />
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('dangerZone.deleteAccount')}</Label>
                    <p className="text-xs text-muted-foreground">{t('dangerZone.deleteAccountDescription')}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">{t('dangerZone.deleteAccount')}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('dangerZone.deleteConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('dangerZone.deleteConfirmDescription')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('familia.cancel')}</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toast.info('Please contact an administrator to delete your account')}>
                          {t('dangerZone.deleteAccount')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
